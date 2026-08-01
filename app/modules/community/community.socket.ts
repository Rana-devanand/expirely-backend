import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../../common/service/passport-jwt.service";
import * as communityService from "./community.service";

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

    socket.on("conversation:join", async (conversationId: string, acknowledge) => {
      try {
        await communityService.assertParticipant(authenticatedUserId, conversationId);
        socket.join(`conversation:${conversationId}`);
        socket.data.communityConversations.add(conversationId);
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
            replyToMessageId: payload.replyToMessageId,
          },
          payload.clientMessageId,
        );
        acknowledge?.({ success: true, data: job });
      } catch (error: any) {
        acknowledge?.({ success: false, message: error.message });
      }
    });

    socket.on("typing:set", (payload: { conversationId: string; isTyping: boolean }) => {
      if (!socket.data.communityConversations.has(payload.conversationId)) return;
      socket.to(`conversation:${payload.conversationId}`).emit("typing:changed", {
        conversationId: payload.conversationId,
        userId: authenticatedUserId,
        isTyping: Boolean(payload.isTyping),
      });
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
