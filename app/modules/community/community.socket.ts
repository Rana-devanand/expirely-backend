import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../../common/service/passport-jwt.service";
import * as communityService from "./community.service";
import { supabaseAdmin } from "../../common/service/supabase.admin";

export function initializeCommunitySocket(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token || socket.handshake.headers.authorization;
      const token = typeof raw === "string" ? raw.replace(/^Bearer\s+/i, "") : "";
      if (!token) return next(new Error("Authentication required"));
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const authenticatedUserId = socket.data.user.id as string;
    socket.data.communityConversations = new Set<string>();
    socket.join(`user:${authenticatedUserId}`);
    io.to(`presence:${authenticatedUserId}`).emit("presence:status", {
      userId: authenticatedUserId,
      isOnline: true,
      lastSeenAt: null,
    });

    const getConversationPresence = async (conversationId: string) => {
      const conversation = await communityService.assertParticipant(
        authenticatedUserId,
        conversationId,
      );
      const otherUserId =
        conversation.buyer_id === authenticatedUserId
          ? conversation.seller_id
          : conversation.buyer_id;
      const sockets = await io.in(`user:${otherUserId}`).fetchSockets();
      const { data: otherUser } = await supabaseAdmin
        .from("users")
        .select("last_seen_at")
        .eq("id", otherUserId)
        .maybeSingle();
      return {
        userId: otherUserId,
        isOnline: sockets.length > 0,
        lastSeenAt: otherUser?.last_seen_at || null,
      };
    };

    socket.on("conversation:join", async (conversationId: string, acknowledge) => {
      try {
        await communityService.assertParticipant(authenticatedUserId, conversationId);
        socket.join(`conversation:${conversationId}`);
        socket.data.communityConversations.add(conversationId);
        const presence = await getConversationPresence(conversationId);
        socket.join(`presence:${presence.userId}`);
        socket.to(`conversation:${conversationId}`).emit("presence:status", {
          userId: authenticatedUserId,
          isOnline: true,
          lastSeenAt: null,
        });
        const seenMessages = await communityService.markConversationSeen(
          authenticatedUserId,
          conversationId,
        );
        if (seenMessages.length) {
          io.to(`conversation:${conversationId}`).emit("messages:status", {
            conversationId,
            messages: seenMessages,
          });
        }
        acknowledge?.({ success: true, seenMessages });
      } catch (error: any) {
        acknowledge?.({ success: false, message: error.message });
      }
    });

    socket.on("message:send", async (payload, acknowledge) => {
      try {
        const job = await communityService.enqueueMessage(
          authenticatedUserId,
          payload.conversationId,
          {
            body: payload.body,
            offerAmount: payload.offerAmount,
            mediaUrl: payload.mediaUrl,
            mediaSizeBytes: payload.mediaSizeBytes,
            mediaMimeType: payload.mediaMimeType,
            mediaFileName: payload.mediaFileName,
            replyToMessageId: payload.replyToMessageId,
          },
          payload.clientMessageId,
        );
        acknowledge?.({ success: true, data: job });
      } catch (error: any) {
        acknowledge?.({ success: false, message: error.message });
      }
    });

    socket.on("presence:get", async (conversationId: string, acknowledge) => {
      try {
        const presence = await getConversationPresence(conversationId);
        acknowledge?.({ success: true, data: presence });
      } catch (error: any) {
        acknowledge?.({ success: false, message: error.message });
      }
    });

    socket.on("presence:subscribe", async (conversationId: string, acknowledge) => {
      try {
        const presence = await getConversationPresence(conversationId);
        socket.join(`presence:${presence.userId}`);
        acknowledge?.({ success: true, data: presence });
      } catch (error: any) {
        acknowledge?.({ success: false, message: error.message });
      }
    });

    socket.on("presence:unsubscribe", async (conversationId: string) => {
      try {
        const presence = await getConversationPresence(conversationId);
        socket.leave(`presence:${presence.userId}`);
      } catch {
        // Socket disconnect also removes all presence subscriptions.
      }
    });

    socket.on(
      "message:delivered",
      async (payload: { messageId?: string }, acknowledge) => {
        try {
          if (!payload?.messageId) throw new Error("Message ID is required");
          const message = await communityService.confirmMessageDelivered(
            authenticatedUserId,
            payload.messageId,
          );
          if (message.sender_id !== authenticatedUserId) {
            const status = {
              id: message.id,
              delivered_at: message.delivered_at,
              seen_at: message.seen_at,
            };
            io.to(`conversation:${message.conversation_id}`)
              .to(`user:${message.sender_id}`)
              .emit("messages:status", {
                conversationId: message.conversation_id,
                messages: [status],
              });
          }
          acknowledge?.({ success: true });
        } catch (error: any) {
          acknowledge?.({ success: false, message: error.message });
        }
      },
    );

    socket.on("disconnect", async () => {
      try {
        const remainingSockets = await io
          .in(`user:${authenticatedUserId}`)
          .fetchSockets();
        if (remainingSockets.length > 0) return;
        const lastSeenAt = new Date().toISOString();
        await supabaseAdmin
          .from("users")
          .update({ last_seen_at: lastSeenAt })
          .eq("id", authenticatedUserId);
        io.to(`presence:${authenticatedUserId}`).emit("presence:status", {
          userId: authenticatedUserId,
          isOnline: false,
          lastSeenAt,
        });
        for (const conversationId of socket.data.communityConversations as Set<string>) {
          io.to(`conversation:${conversationId}`).emit("presence:status", {
            userId: authenticatedUserId,
            isOnline: false,
            lastSeenAt,
          });
        }
      } catch (error: any) {
        console.warn("[Community Presence] Disconnect update failed:", error.message);
      }
    });

    socket.on("typing:set", async (payload: { conversationId: string; isTyping: boolean }) => {
      const conversationId = String(payload?.conversationId || "");
      if (!conversationId) return;
      try {
        // Recover safely when a reconnect cleared server-side room membership.
        if (!socket.data.communityConversations.has(conversationId)) {
          await communityService.assertParticipant(authenticatedUserId, conversationId);
          await socket.join(`conversation:${conversationId}`);
          socket.data.communityConversations.add(conversationId);
        }
        socket.to(`conversation:${conversationId}`).emit("typing:changed", {
          conversationId,
          userId: authenticatedUserId,
          isTyping: Boolean(payload.isTyping),
        });
      } catch (error: any) {
        console.warn("[Community Typing] Event rejected:", error.message);
      }
    });

    socket.on("conversation:seen", async (conversationId: string) => {
      if (!socket.data.communityConversations.has(conversationId)) return;
      try {
        const seenMessages = await communityService.markConversationSeen(
          authenticatedUserId,
          conversationId,
        );
        if (seenMessages.length) {
          io.to(`conversation:${conversationId}`).emit("messages:status", {
            conversationId,
            messages: seenMessages,
          });
        }
      } catch {
        // The next authenticated join/read will retry the receipt update.
      }
    });

    socket.on(
      "conversation:viewing",
      (payload: { conversationId: string; isViewing: boolean }) => {
        if (!socket.data.communityConversations.has(payload.conversationId)) return;
        socket.data.activeCommunityConversation = payload.isViewing
          ? payload.conversationId
          : null;
      },
    );
  });

  return io;
}
