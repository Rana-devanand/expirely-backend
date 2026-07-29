import { supabaseAdmin } from "../../common/service/supabase.admin";

const DELETE_BATCH_SIZE = 500;
const MAX_BATCHES_PER_RUN = 20;

export async function cleanupExpiredCommunityMessages() {
  let totalDeleted = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const { data, error } = await supabaseAdmin.rpc(
      "cleanup_expired_community_messages",
      { batch_size: DELETE_BATCH_SIZE },
    );
    if (error) throw error;

    const deleted = Number(data || 0);
    totalDeleted += deleted;
    if (deleted < DELETE_BATCH_SIZE) break;
  }

  if (totalDeleted > 0) {
    console.log(
      `[Community Cleanup] Deleted ${totalDeleted} expired messages.`,
    );
  }
  return totalDeleted;
}
