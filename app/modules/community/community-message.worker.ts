import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { supabaseAdmin } from "../../common/service/supabase.admin";
import * as communityService from "./community.service";

type QueueJob = {
  id: string;
  sender_id: string;
  conversation_id: string;
  idempotency_key: string;
  payload: {
    body?: string;
    offerAmount?: number;
    mediaUrl?: string;
    replyToMessageId?: string;
    clientMessageId: string;
  };
  attempt_count: number;
  max_attempts: number;
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class CommunityMessageWorker {
  private running = false;
  private readonly workerId = `${process.env.RENDER_INSTANCE_ID || "local"}:${randomUUID()}`;

  async start(io: Server) {
    if (this.running) return;
    this.running = true;
    console.log(`[Community Queue] Worker started: ${this.workerId}`);

    while (this.running) {
      try {
        const { data, error } = await supabaseAdmin.rpc(
          "claim_community_message_jobs",
          { worker_id: this.workerId, batch_size: 20 },
        );
        if (error) throw error;
        const jobs = (data || []) as QueueJob[];
        if (!jobs.length) {
          await wait(500);
          continue;
        }
        await Promise.all(jobs.map((job) => this.process(io, job)));
      } catch (error: any) {
        console.error("[Community Queue] Worker error:", error.message);
        await wait(2000);
      }
    }
  }

  stop() {
    this.running = false;
  }

  private async process(io: Server, job: QueueJob) {
    try {
      let message = await communityService.sendMessage(
        job.sender_id,
        job.conversation_id,
        job.payload,
      );
      const conversation = await communityService.assertParticipant(
        job.sender_id,
        job.conversation_id,
      );
      const recipientId =
        conversation.buyer_id === job.sender_id
          ? conversation.seller_id
          : conversation.buyer_id;
      const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets();
      const recipientActivelyViewing = recipientSockets.some(
        (socket) =>
          socket.data.activeCommunityConversation === job.conversation_id,
      );
      if (recipientSockets.length > 0) {
        const delivered = await communityService.markMessageDelivered(message.id);
        if (delivered) message = { ...message, ...delivered };
      }

      const { error: completionError } = await supabaseAdmin
        .from("community_message_queue")
        .update({
          status: "completed",
          message_id: message.id,
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "processing")
        .eq("locked_by", this.workerId);
      if (completionError) throw completionError;

      io.to(`conversation:${job.conversation_id}`)
        .to(`user:${recipientId}`)
        .to(`user:${job.sender_id}`)
        .emit("message:new", message);
      io.to(`user:${job.sender_id}`).emit("message:queue_status", {
        jobId: job.id,
        clientMessageId: job.idempotency_key,
        conversationId: job.conversation_id,
        status: "completed",
        message,
      });
      if (!recipientActivelyViewing) {
        void communityService
          .sendCommunityMessagePush(job.sender_id, job.conversation_id, message)
          .catch((error) =>
            console.error("[Community Queue] Push failed:", error.message),
          );
      }
    } catch (error: any) {
      const { data: failedJob, error: failError } = await supabaseAdmin.rpc(
        "fail_community_message_job",
        {
          job_id: job.id,
          worker_id: this.workerId,
          error_message: error.message || "Message processing failed",
        },
      );
      if (failError) {
        console.error("[Community Queue] Could not fail job:", failError.message);
        return;
      }
      io.to(`user:${job.sender_id}`).emit("message:queue_status", {
        jobId: job.id,
        clientMessageId: job.idempotency_key,
        conversationId: job.conversation_id,
        status: failedJob?.status || "pending",
        attemptCount: failedJob?.attempt_count,
        nextAttemptAt: failedJob?.available_at,
        error: failedJob?.last_error,
      });
    }
  }
}

export const communityMessageWorker = new CommunityMessageWorker();
