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
    console.log(`⚡ [Community Queue Worker] Started & listening for queued messages... (Worker ID: ${this.workerId})`);

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
        console.log(`📦 [Community Queue Worker] Claimed ${jobs.length} message job(s) from database queue.`);
        await Promise.all(jobs.map((job) => this.process(io, job)));
      } catch (error: any) {
        console.error("[Community Queue Worker] Worker loop error:", error.message);
        await wait(2000);
      }
    }
  }

  stop() {
    this.running = false;
    console.log(`🛑 [Community Queue Worker] Stopped (Worker ID: ${this.workerId})`);
  }

  private async process(io: Server, job: QueueJob) {
    console.log(`🔄 [Community Queue Worker] Processing job [${job.id}] (Key: ${job.idempotency_key}, Sender: ${job.sender_id})`);
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

      console.log(`✅ [Community Queue Worker] Job [${job.id}] completed successfully -> Message ID: ${message.id}`);

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
            console.error("[Community Queue Worker] Push failed:", error.message),
          );
      }
    } catch (error: any) {
      console.warn(`⚠️ [Community Queue Worker] Processing failed for job [${job.id}]: ${error.message}. Marking job status...`);
      const { data: failedJob, error: failError } = await supabaseAdmin.rpc(
        "fail_community_message_job",
        {
          job_id: job.id,
          worker_id: this.workerId,
          error_message: error.message || "Message processing failed",
        },
      );
      if (failError) {
        console.error("[Community Queue Worker] Could not update failed job status:", failError.message);
        return;
      }
      console.warn(`❌ [Community Queue Worker] Job [${job.id}] marked as ${failedJob?.status || "failed"} (Attempt #${failedJob?.attempt_count})`);
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
