import createHttpError from "http-errors";
import { supabaseAdmin } from "../../common/service/supabase.admin";
import {
  CreateCommunityListing,
  SendCommunityMessage,
  UpdateCommunityChatSettings,
} from "./community.model";
import { sendPushNotification } from "../../common/service/fcm.service";

const listingSelect =
  "*, seller:users!community_listings_seller_id_fkey(id, username, avatar_url, user_locations(country))";

async function addLikeState(listings: any[], userId?: string) {
  if (!listings.length) return listings;
  const listingIds = listings.map((listing) => listing.id);
  const { data: likes, error } = await supabaseAdmin.from("community_likes")
    .select("listing_id,user_id").in("listing_id", listingIds);
  if (error) throw createHttpError(500, error.message);
  const counts = new Map<string, number>();
  const likedByUser = new Set<string>();
  for (const like of likes || []) {
    counts.set(like.listing_id, (counts.get(like.listing_id) || 0) + 1);
    if (userId && like.user_id === userId) likedByUser.add(like.listing_id);
  }
  return listings.map((listing) => ({
    ...listing,
    likes_count: counts.get(listing.id) || 0,
    liked_by_me: likedByUser.has(listing.id),
  }));
}

export async function getListings(userId: string, search?: string, category?: string, sellerId?: string) {
  let follows: any[] = [];
  let blocks: any[] = [];
  try {
    const [followsRes, blocksRes] = await Promise.all([
      supabaseAdmin.from("community_follows").select("following_id").eq("follower_id", userId),
      supabaseAdmin.from("community_blocks").select("blocked_id").eq("blocker_id", userId),
    ]);
    if (followsRes.data) follows = followsRes.data;
    if (blocksRes.data) blocks = blocksRes.data;
  } catch (e) {
    console.error("[getListings] Error fetching follows/blocks:", e);
  }
  const followedIds = new Set(follows.map((row: any) => row.following_id));
  const blockedIds = new Set(blocks.map((row: any) => row.blocked_id));
  let query = supabaseAdmin
    .from("community_listings")
    .select(listingSelect)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  if (category) query = query.eq("category", category);
  if (sellerId) query = query.eq("seller_id", sellerId);
  const { data, error } = await query;
  if (error) throw createHttpError(500, error.message);
  const visibleListings = (data || [])
    .filter((listing: any) => !blockedIds.has(listing.seller_id))
    .map((listing: any) => ({
      ...listing,
      is_following: followedIds.has(listing.seller_id),
    }))
    .sort((a: any, b: any) =>
      Number(b.is_following) - Number(a.is_following) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return addLikeState(visibleListings, userId);
}

export async function getListing(id: string, userId?: string) {
  const { data, error } = await supabaseAdmin
    .from("community_listings").select(listingSelect).eq("id", id).single();
  if (error || !data) throw createHttpError(404, "Community listing not found");
  return (await addLikeState([data], userId))[0];
}

async function notifyFollowersOfNewPost(sellerId: string, listing: any) {
  try {
    const { data: follows } = await supabaseAdmin
      .from("community_follows")
      .select("follower_id")
      .eq("following_id", sellerId);

    if (!follows || follows.length === 0) return;

    const followerIds = follows.map((f) => f.follower_id);

    const { data: followers } = await supabaseAdmin
      .from("users")
      .select("id, fcm_token")
      .in("id", followerIds);

    if (!followers || followers.length === 0) return;

    const sellerName = listing.seller?.username || "A user you follow";
    const postTitle = listing.title || "a new product";
    const notificationTitle = `New Post from ${sellerName}! 🛍️`;
    const notificationMessage = `${sellerName} shared: "${postTitle}". Tap to check it out!`;
    const imageUrl = listing.image_urls?.[0] || undefined;

    const notificationsToInsert = followers.map((user) => ({
      user_id: user.id,
      title: notificationTitle,
      message: notificationMessage,
      type: "info",
      created_at: new Date().toISOString(),
    }));

    await supabaseAdmin.from("notifications").insert(notificationsToInsert);

    for (const follower of followers) {
      if (follower.fcm_token) {
        sendPushNotification(
          follower.fcm_token,
          notificationTitle,
          notificationMessage,
          {
            type: "COMMUNITY_POST",
            listingId: String(listing.id),
            sellerId: String(sellerId),
            imageUrl: imageUrl || "",
          },
          { imageUrl, channelId: "community-posts" },
        ).catch((err) => console.error("Error sending follower push:", err));
      }
    }
  } catch (err: any) {
    console.error("❌ Exception in notifyFollowersOfNewPost:", err.message || err);
  }
}

export async function createListing(userId: string, input: CreateCommunityListing) {
  if (!input.title?.trim() || !input.description?.trim())
    throw createHttpError(400, "Title and description are required");
  if (!Number.isFinite(Number(input.price)) || Number(input.price) < 0)
    throw createHttpError(400, "A valid price is required");
  if (!input.imageUrls?.length)
    throw createHttpError(400, "At least one product image is required");
  const { data, error } = await supabaseAdmin.from("community_listings").insert({
    seller_id: userId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category?.trim() || null,
    price: Number(input.price),
    currency: input.currency || "USD",
    quantity: input.quantity || 1,
    condition: input.condition || "new",
    location: input.location?.trim() || null,
    image_urls: input.imageUrls,
  }).select(listingSelect).single();
  if (error) throw createHttpError(500, error.message);

  notifyFollowersOfNewPost(userId, data);

  return data;
}

export async function getMyListings(userId: string) {
  const { data, error } = await supabaseAdmin.from("community_listings")
    .select(listingSelect)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw createHttpError(500, error.message);
  return addLikeState(data || [], userId);
}

export async function updateListing(
  userId: string,
  id: string,
  input: Partial<CreateCommunityListing>,
) {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!input.title.trim()) throw createHttpError(400, "Title is required");
    updates.title = input.title.trim();
  }
  if (input.description !== undefined) {
    if (!input.description.trim()) throw createHttpError(400, "Description is required");
    updates.description = input.description.trim();
  }
  if (input.price !== undefined) {
    if (!Number.isFinite(Number(input.price)) || Number(input.price) < 0)
      throw createHttpError(400, "A valid price is required");
    updates.price = Number(input.price);
  }
  if (input.quantity !== undefined) {
    if (!Number.isInteger(Number(input.quantity)) || Number(input.quantity) < 1)
      throw createHttpError(400, "Quantity must be at least 1");
    updates.quantity = Number(input.quantity);
  }
  if (input.imageUrls !== undefined) {
    if (!input.imageUrls.length) throw createHttpError(400, "At least one product image is required");
    updates.image_urls = input.imageUrls;
  }
  if (input.category !== undefined) updates.category = input.category.trim() || null;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.condition !== undefined) updates.condition = input.condition;
  if (input.location !== undefined) updates.location = input.location.trim() || null;

  const { data, error } = await supabaseAdmin.from("community_listings")
    .update(updates).eq("id", id).eq("seller_id", userId)
    .select(listingSelect).maybeSingle();
  if (error) throw createHttpError(500, error.message);
  if (!data) throw createHttpError(404, "Listing not found or not owned by you");
  return (await addLikeState([data], userId))[0];
}

export async function deleteListing(userId: string, id: string) {
  const { data, error } = await supabaseAdmin.from("community_listings")
    .delete().eq("id", id).eq("seller_id", userId).select("id").maybeSingle();
  if (error) throw createHttpError(500, error.message);
  if (!data) throw createHttpError(404, "Listing not found or not owned by you");
  return data;
}

export async function updateListingStatus(userId: string, id: string, status: string) {
  if (!["active", "reserved", "sold", "inactive"].includes(status))
    throw createHttpError(400, "Invalid listing status");
  const { data, error } = await supabaseAdmin.from("community_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id).eq("seller_id", userId).select().single();
  if (error || !data) throw createHttpError(404, "Listing not found or not owned by you");
  return data;
}

function assertOtherUser(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw createHttpError(400, "You cannot perform this action on yourself");
}

export async function followUser(userId: string, followingId: string) {
  assertOtherUser(userId, followingId);
  const { data: blocked } = await supabaseAdmin.from("community_blocks")
    .select("id").eq("blocker_id", userId).eq("blocked_id", followingId).maybeSingle();
  if (blocked) throw createHttpError(400, "Unblock this user before following them");
  const { data, error } = await supabaseAdmin.from("community_follows")
    .upsert({ follower_id: userId, following_id: followingId }, { onConflict: "follower_id,following_id" })
    .select().single();
  if (error) throw createHttpError(500, error.message);
  return data;
}

export async function unfollowUser(userId: string, followingId: string) {
  const { error } = await supabaseAdmin.from("community_follows")
    .delete().eq("follower_id", userId).eq("following_id", followingId);
  if (error) throw createHttpError(500, error.message);
  return { following_id: followingId };
}

export async function blockUser(userId: string, blockedId: string) {
  assertOtherUser(userId, blockedId);
  const { data, error } = await supabaseAdmin.from("community_blocks")
    .upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" })
    .select().single();
  if (error) throw createHttpError(500, error.message);
  await supabaseAdmin.from("community_follows")
    .delete().eq("follower_id", userId).eq("following_id", blockedId);
  return data;
}

export async function unblockUser(userId: string, blockedId: string) {
  const { error } = await supabaseAdmin.from("community_blocks")
    .delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
  if (error) throw createHttpError(500, error.message);
  return { blocked_id: blockedId };
}

export async function getBlockedUsers(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("community_blocks")
    .select(
      "id,created_at,blocked_user:users!community_blocks_blocked_id_fkey(id,username,email,avatar_url)",
    )
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw createHttpError(500, error.message);
  return (data || []).map((item: any) => ({
    ...item.blocked_user,
    blocked_at: item.created_at,
  }));
}

export async function likeListing(userId: string, listingId: string) {
  const listing = await getListing(listingId);
  if (listing.seller_id === userId) throw createHttpError(400, "You cannot like your own product");
  const { data: existing } = await supabaseAdmin.from("community_likes")
    .select("id").eq("listing_id", listingId).eq("user_id", userId).maybeSingle();
  if (existing) {
    const [updated] = await addLikeState([listing], userId);
    return updated;
  }
  const { error } = await supabaseAdmin.from("community_likes").insert({
    listing_id: listingId,
    user_id: userId,
  });
  if (error) throw createHttpError(500, error.message);

  const [{ data: liker }, { data: seller }] = await Promise.all([
    supabaseAdmin.from("users").select("username,avatar_url").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("users").select("id,fcm_token").eq("id", listing.seller_id).maybeSingle(),
  ]);
  const likerName = liker?.username || "A community member";
  const title = "Your product received a like";
  const message = `${likerName} liked "${listing.title}".`;
  if (seller) {
    await supabaseAdmin.from("notifications").insert({
      user_id: seller.id,
      title,
      message,
      type: "info",
      created_at: new Date().toISOString(),
    });
    if (seller.fcm_token) {
      await sendPushNotification(seller.fcm_token, title, message, {
        type: "COMMUNITY_LIKE",
        listingId,
        likerId: userId,
        likerName,
      }, {
        imageUrl: listing.image_urls?.[0] || liker?.avatar_url,
        channelId: "community-activity",
      });
    }
  }
  return (await addLikeState([listing], userId))[0];
}

export async function unlikeListing(userId: string, listingId: string) {
  const { error } = await supabaseAdmin.from("community_likes")
    .delete().eq("listing_id", listingId).eq("user_id", userId);
  if (error) throw createHttpError(500, error.message);
  const listing = await getListing(listingId);
  return (await addLikeState([listing], userId))[0];
}

export async function reportListing(
  reporterId: string,
  listingId: string,
  input: { reason?: string; details?: string },
) {
  const reason = input.reason?.trim();
  if (!reason) throw createHttpError(400, "Please select a report reason");
  const listing = await getListing(listingId);
  if (listing.seller_id === reporterId) throw createHttpError(400, "You cannot report your own post");
  const { data: report, error } = await supabaseAdmin.from("community_reports").insert({
    reporter_id: reporterId,
    listing_id: listingId,
    reported_user_id: listing.seller_id,
    reason,
    details: input.details?.trim() || null,
  }).select().single();
  if (error?.code === "23505") throw createHttpError(409, "You already reported this post");
  if (error || !report) throw createHttpError(500, error?.message || "Unable to report post");

  const [{ data: admins }, { data: reporter }] = await Promise.all([
    supabaseAdmin.from("users").select("id,fcm_token").eq("role", "ADMIN"),
    supabaseAdmin.from("users").select("username").eq("id", reporterId).maybeSingle(),
  ]);
  const title = "Community post reported";
  const message = `${reporter?.username || "A community member"} reported "${listing.title}" for ${reason}.`;
  if (admins?.length) {
    await supabaseAdmin.from("notifications").insert(admins.map((admin: any) => ({
      user_id: admin.id,
      title,
      message,
      type: "warning",
      created_at: new Date().toISOString(),
    })));
    await Promise.all(admins.filter((admin: any) => admin.fcm_token).map((admin: any) =>
      sendPushNotification(admin.fcm_token, title, message, {
        type: "COMMUNITY_REPORT",
        reportId: report.id,
        listingId,
      }, { imageUrl: listing.image_urls?.[0] }),
    ));
  }
  return report;
}

export async function getReports() {
  const { data, error } = await supabaseAdmin.from("community_reports")
    .select("*, listing:community_listings(*), reporter:users!community_reports_reporter_id_fkey(id,username,avatar_url), reported_user:users!community_reports_reported_user_id_fkey(id,username,avatar_url)")
    .order("created_at", { ascending: false });
  if (error) throw createHttpError(500, error.message);
  return data || [];
}

export async function getAdminListings() {
  const { data, error } = await supabaseAdmin
    .from("community_listings")
    .select(listingSelect)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw createHttpError(500, error.message);
  return addLikeState(data || []);
}

export async function getAdminCommunityStats() {
  const [
    { count: totalPosts, error: postsError },
    { data: reportedRows, error: reportsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("community_listings")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("community_reports")
      .select("listing_id"),
  ]);
  const error = postsError || reportsError;
  if (error) throw createHttpError(500, error.message);
  return {
    totalPosts: totalPosts || 0,
    reportedPosts: new Set((reportedRows || []).map((row) => row.listing_id))
      .size,
  };
}

export async function getAdminActivity() {
  const [
    { data: listings, error: listingsError },
    { data: reports, error: reportsError },
    { data: likes, error: likesError },
    { data: follows, error: followsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("community_listings")
      .select("id,title,created_at,seller:users!community_listings_seller_id_fkey(id,username)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("community_reports")
      .select("id,reason,status,created_at,reporter:users!community_reports_reporter_id_fkey(id,username),listing:community_listings(id,title)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("community_likes")
      .select("id,created_at,user:users(id,username),listing:community_listings(id,title)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("community_follows")
      .select("id,created_at,follower:users!community_follows_follower_id_fkey(id,username),following:users!community_follows_following_id_fkey(id,username)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const error = listingsError || reportsError || likesError || followsError;
  if (error) throw createHttpError(500, error.message);

  return [
    ...(listings || []).map((item: any) => ({
      id: `listing-${item.id}`,
      type: "POST_CREATED",
      actor: item.seller,
      title: "Community post created",
      detail: item.title,
      created_at: item.created_at,
    })),
    ...(reports || []).map((item: any) => ({
      id: `report-${item.id}`,
      type: "POST_REPORTED",
      actor: item.reporter,
      title: "Community post reported",
      detail: `${item.listing?.title || "Deleted post"} · ${item.reason}`,
      status: item.status,
      created_at: item.created_at,
    })),
    ...(likes || []).map((item: any) => ({
      id: `like-${item.id}`,
      type: "POST_LIKED",
      actor: item.user,
      title: "Community post liked",
      detail: item.listing?.title || "Deleted post",
      created_at: item.created_at,
    })),
    ...(follows || []).map((item: any) => ({
      id: `follow-${item.id}`,
      type: "USER_FOLLOWED",
      actor: item.follower,
      title: "Community member followed",
      detail: item.following?.username || "Community member",
      created_at: item.created_at,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 100);
}

export async function reviewReport(
  adminId: string,
  reportId: string,
  input: { status?: string; adminNote?: string; listingStatus?: string },
) {
  const statuses = ["pending", "reviewing", "resolved", "dismissed"];
  if (!statuses.includes(input.status || "")) throw createHttpError(400, "Invalid report status");
  if (input.listingStatus && !["active", "reserved", "sold", "inactive"].includes(input.listingStatus))
    throw createHttpError(400, "Invalid listing status");
  const { data, error } = await supabaseAdmin.from("community_reports").update({
    status: input.status,
    admin_note: input.adminNote?.trim() || null,
    reviewed_by: adminId,
    updated_at: new Date().toISOString(),
  }).eq("id", reportId).select().single();
  if (error || !data) throw createHttpError(404, "Report not found");
  if (input.listingStatus) {
    await supabaseAdmin.from("community_listings").update({
      status: input.listingStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", data.listing_id);
  }
  return data;
}

export async function startConversation(userId: string, listingId: string) {
  const listing = await getListing(listingId);
  if (listing.seller_id === userId) throw createHttpError(400, "You cannot buy your own listing");
  const { data, error } = await supabaseAdmin.from("community_conversations")
    .upsert({ listing_id: listingId, buyer_id: userId, seller_id: listing.seller_id },
      { onConflict: "listing_id,buyer_id,seller_id" })
    .select().single();
  if (error) throw createHttpError(500, error.message);
  return data;
}

export async function getConversations(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("community_conversations")
    .select(
      "id,listing_id,buyer_id,seller_id,updated_at,last_message_text,last_message_type,last_message_at,last_message_sender_id,buyer_unread_count,seller_unread_count,listing:community_listings(id,title,price,currency,image_urls,status),buyer:users!community_conversations_buyer_id_fkey(id,username,avatar_url),seller:users!community_conversations_seller_id_fkey(id,username,avatar_url)",
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw createHttpError(500, error.message);
  return (data || []).map((conversation: any) => ({
    ...conversation,
    unread_count:
      conversation.buyer_id === userId
        ? conversation.buyer_unread_count
        : conversation.seller_unread_count,
  }));
}
export async function assertParticipant(userId: string, conversationId: string) {
  const { data, error } = await supabaseAdmin.from("community_conversations")
    .select("*").eq("id", conversationId).single();
  if (error || !data || (data.buyer_id !== userId && data.seller_id !== userId))
    throw createHttpError(403, "You are not part of this conversation");
  return data;
}

export async function getConversationSettings(
  userId: string,
  conversationId: string,
) {
  await assertParticipant(userId, conversationId);
  const { data, error } = await supabaseAdmin
    .from("community_conversation_settings")
    .select(
      "conversation_id,auto_delete_mode,auto_delete_duration_seconds,settings,updated_at",
    )
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw createHttpError(500, error.message);
  return (
    data || {
      conversation_id: conversationId,
      auto_delete_mode: null,
      auto_delete_duration_seconds: null,
      settings: {},
      updated_at: null,
    }
  );
}

export async function updateConversationSettings(
  userId: string,
  conversationId: string,
  input: UpdateCommunityChatSettings,
) {
  await assertParticipant(userId, conversationId);
  const allowedModes = new Set([
    "one_hour",
    "twenty_four_hours",
    "custom",
  ]);
  if (!allowedModes.has(input.autoDeleteMode)) {
    throw createHttpError(400, "Select a valid auto-delete option");
  }

  let durationSeconds =
    input.autoDeleteMode === "one_hour"
      ? 3600
      : input.autoDeleteMode === "twenty_four_hours"
        ? 86400
        : 0;
  if (input.autoDeleteMode === "custom") {
    const duration = Number(input.customDuration);
    if (!Number.isInteger(duration) || duration < 1) {
      throw createHttpError(400, "Custom duration must be a positive integer");
    }
    if (input.customUnit !== "hours" && input.customUnit !== "days") {
      throw createHttpError(400, "Custom duration unit must be hours or days");
    }
    durationSeconds =
      duration * (input.customUnit === "days" ? 86400 : 3600);
  }
  if (durationSeconds < 3600 || durationSeconds > 31536000) {
    throw createHttpError(
      400,
      "Auto-delete duration must be between 1 hour and 365 days",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("community_conversation_settings")
    .upsert(
      {
        conversation_id: conversationId,
        auto_delete_mode: input.autoDeleteMode,
        auto_delete_duration_seconds: durationSeconds,
        settings:
          input.autoDeleteMode === "custom"
            ? {
                custom_duration: Number(input.customDuration),
                custom_unit: input.customUnit,
              }
            : {},
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" },
    )
    .select(
      "conversation_id,auto_delete_mode,auto_delete_duration_seconds,settings,updated_at",
    )
    .single();
  if (error) throw createHttpError(500, error.message);
  return data;
}

const messageSelect = `
  *,
  sender:users!community_messages_sender_id_fkey(id,username,avatar_url),
  reply_to_message:community_messages!reply_to_message_id(id,body,message_type,offer_amount,media_url,sender_id,sender:users!community_messages_sender_id_fkey(id,username,avatar_url))
`;

export async function getMessages(
  userId: string,
  conversationId: string,
  before?: string,
  limit: number = 100,
) {
  await assertParticipant(userId, conversationId);
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 100), 100);
  let query = supabaseAdmin
    .from("community_messages")
    .select(messageSelect)
    .eq("conversation_id", conversationId);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(parsedLimit);

  if (error) throw createHttpError(500, error.message);
  return (data || []).reverse();
}

export async function sendMessage(
  userId: string, conversationId: string, input: SendCommunityMessage,
) {
  const conversation = await assertParticipant(userId, conversationId);
  if (input.clientMessageId) {
    const { data: existing } = await supabaseAdmin
      .from("community_messages")
      .select(messageSelect)
      .eq("sender_id", userId)
      .eq("client_message_id", input.clientMessageId)
      .maybeSingle();
    if (existing) return existing;
  }
  const body = input.body?.trim();
  const mediaUrl = input.mediaUrl?.trim();
  const offerAmount = input.offerAmount == null ? null : Number(input.offerAmount);
  if (!body && !mediaUrl && (!Number.isFinite(offerAmount) || Number(offerAmount) < 0))
    throw createHttpError(400, "Enter a message, image, or valid offer");
  if (input.replyToMessageId) {
    const { data: repliedMessage } = await supabaseAdmin
      .from("community_messages")
      .select("conversation_id")
      .eq("id", input.replyToMessageId)
      .maybeSingle();
    if (!repliedMessage || repliedMessage.conversation_id !== conversationId) {
      throw createHttpError(400, "The replied message is not in this conversation");
    }
  }
  const { data, error } = await supabaseAdmin.from("community_messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    body: body || null,
    message_type: offerAmount !== null ? "offer" : mediaUrl ? "media" : "text",
    media_url: mediaUrl || null,
    reply_to_message_id: input.replyToMessageId || null,
    client_message_id: input.clientMessageId || null,
    offer_amount: offerAmount,
    offer_status: offerAmount !== null ? "pending" : null,
  }).select(messageSelect).single();
  if (error) throw createHttpError(500, error.message);
  const preview = offerAmount !== null
    ? `Offer: ${offerAmount}`
    : mediaUrl ? "📷 Photo" : body || "New message";
  await supabaseAdmin.from("community_conversations")
    .update({
      updated_at: data.created_at,
      last_message_text: preview,
      last_message_type: data.message_type,
      last_message_at: data.created_at,
      last_message_sender_id: userId,
      buyer_unread_count:
        conversation.buyer_id === userId
          ? conversation.buyer_unread_count
          : (conversation.buyer_unread_count || 0) + 1,
      seller_unread_count:
        conversation.seller_id === userId
          ? conversation.seller_unread_count
          : (conversation.seller_unread_count || 0) + 1,
    }).eq("id", conversationId);
  return data;
}

export async function enqueueMessage(
  userId: string,
  conversationId: string,
  input: SendCommunityMessage,
  idempotencyKey: string,
) {
  await assertParticipant(userId, conversationId);
  const key = String(idempotencyKey || "").trim();
  if (!key || key.length < 8 || key.length > 128) {
    throw createHttpError(400, "A valid idempotency key is required");
  }
  const body = input.body?.trim();
  const mediaUrl = input.mediaUrl?.trim();
  const offerAmount =
    input.offerAmount == null ? null : Number(input.offerAmount);
  if (
    !body &&
    !mediaUrl &&
    (!Number.isFinite(offerAmount) || Number(offerAmount) < 0)
  ) {
    throw createHttpError(400, "Enter a message, image, or valid offer");
  }
  if (input.replyToMessageId) {
    const { data: repliedMessage } = await supabaseAdmin
      .from("community_messages")
      .select("conversation_id")
      .eq("id", input.replyToMessageId)
      .maybeSingle();
    if (!repliedMessage || repliedMessage.conversation_id !== conversationId) {
      throw createHttpError(400, "The replied message is not in this conversation");
    }
  }

  const payload = {
    body: body || undefined,
    mediaUrl: mediaUrl || undefined,
    offerAmount,
    replyToMessageId: input.replyToMessageId,
    clientMessageId: key,
  };
  const { data, error } = await supabaseAdmin
    .from("community_message_queue")
    .upsert(
      {
        sender_id: userId,
        conversation_id: conversationId,
        idempotency_key: key,
        payload,
      },
      { onConflict: "sender_id,idempotency_key", ignoreDuplicates: true },
    )
    .select("id,status,idempotency_key,attempt_count,last_error,created_at")
    .maybeSingle();
  if (error) throw createHttpError(500, error.message);
  if (data) return data;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("community_message_queue")
    .select("id,status,idempotency_key,attempt_count,last_error,created_at")
    .eq("sender_id", userId)
    .eq("idempotency_key", key)
    .single();
  if (existingError) throw createHttpError(500, existingError.message);
  return existing;
}

export async function retryQueuedMessage(userId: string, jobId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "retry_community_message_job",
    { job_id: jobId, requesting_user_id: userId },
  );
  if (error) throw createHttpError(500, error.message);
  if (!data) throw createHttpError(404, "Failed message was not found");
  return data;
}

export async function clearConversation(userId: string, conversationId: string) {
  await assertParticipant(userId, conversationId);
  const { data, error } = await supabaseAdmin.rpc("clear_community_chat", {
    target_conversation_id: conversationId,
  });
  if (error) throw createHttpError(500, error.message);
  return { deletedCount: Number(data || 0) };
}

export async function markMessageDelivered(messageId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("community_messages")
    .update({ delivered_at: timestamp })
    .eq("id", messageId)
    .is("delivered_at", null)
    .select()
    .maybeSingle();
  if (error) throw createHttpError(500, error.message);
  return data;
}

export async function confirmMessageDelivered(
  userId: string,
  messageId: string,
) {
  const { data: message, error: messageError } = await supabaseAdmin
    .from("community_messages")
    .select("id,conversation_id,sender_id,delivered_at,seen_at")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError) throw createHttpError(500, messageError.message);
  if (!message) throw createHttpError(404, "Message not found");

  await assertParticipant(userId, message.conversation_id);

  // Delivery can only be confirmed by the recipient, never by the sender.
  if (message.sender_id === userId || message.delivered_at) return message;

  const delivered = await markMessageDelivered(message.id);
  return delivered ? { ...message, ...delivered } : message;
}

export async function markConversationSeen(userId: string, conversationId: string) {
  const conversation = await assertParticipant(userId, conversationId);
  const timestamp = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("community_messages")
    .update({ delivered_at: timestamp, seen_at: timestamp })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("seen_at", null)
    .select("id,delivered_at,seen_at");
  if (error) throw createHttpError(500, error.message);
  await supabaseAdmin.from("community_conversations")
    .update(
      conversation.buyer_id === userId
        ? { buyer_unread_count: 0 }
        : { seller_unread_count: 0 },
    )
    .eq("id", conversationId);
  return data || [];
}
export async function sendCommunityMessagePush(
  senderId: string,
  conversationId: string,
  message: any,
) {
  const { data: conversation, error } = await supabaseAdmin
    .from("community_conversations")
    .select(
      "buyer_id,seller_id,buyer_unread_count,seller_unread_count,listing:community_listings(id,title,price,currency,image_urls),buyer:users!community_conversations_buyer_id_fkey(id,username,avatar_url,fcm_token),seller:users!community_conversations_seller_id_fkey(id,username,avatar_url,fcm_token)",
    )
    .eq("id", conversationId)
    .single();
  if (error || !conversation) return false;

  const sender: any =
    conversation.buyer_id === senderId ? conversation.buyer : conversation.seller;
  const recipient: any =
    conversation.buyer_id === senderId ? conversation.seller : conversation.buyer;
  const listing: any = conversation.listing;
  if (!recipient?.fcm_token) return false;

  const recipientUnreadCount =
    recipient.id === conversation.buyer_id
      ? conversation.buyer_unread_count || 1
      : conversation.seller_unread_count || 1;

  const senderName = sender?.username || "Community member";

  // Fetch unread messages for this conversation to build a WhatsApp-style multi-line summary
  const { data: unreadMessages } = await supabaseAdmin
    .from("community_messages")
    .select("body, offer_amount, message_type, created_at")
    .eq("conversation_id", conversationId)
    .eq("sender_id", senderId)
    .is("seen_at", null)
    .order("created_at", { ascending: true })
    .limit(6);

  let combinedBody = "";
  if (unreadMessages && unreadMessages.length > 0) {
    combinedBody = unreadMessages
      .map((msg) =>
        msg.message_type === "offer"
          ? `Offer: ${listing?.currency || ""} ${msg.offer_amount}`
          : msg.message_type === "media" ? "📷 Photo" : msg.body || "Message",
      )
      .filter(Boolean)
      .join("\n");
  }

  if (!combinedBody) {
    combinedBody =
      message.message_type === "offer"
        ? `Sent you an offer of ${listing?.currency || ""} ${message.offer_amount}`
        : message.message_type === "media" ? "📷 Sent you a photo" : message.body || "Sent you a message";
  }

  const pushTitle =
    recipientUnreadCount > 1
      ? `${senderName} (${recipientUnreadCount} new messages)`
      : senderName;

  const imageUrl = sender?.avatar_url || listing?.image_urls?.[0] || "";

  await supabaseAdmin.from("notifications").insert({
    user_id: recipient.id,
    title: pushTitle,
    message: combinedBody,
    type: "info",
    created_at: new Date().toISOString(),
  });

  const chatTag = `chat_${conversationId}`;

  return sendPushNotification(
    recipient.fcm_token,
    pushTitle,
    combinedBody,
    {
      type: "COMMUNITY_MESSAGE",
      conversationId,
      listingId: listing?.id || "",
      listingTitle: listing?.title || "Community product",
      price: String(listing?.price || 0),
      role: conversation.seller_id === recipient.id ? "seller" : "buyer",
      senderId,
      senderName,
      imageUrl,
    },
    {
      imageUrl: imageUrl || undefined,
      channelId: "community-messages",
      tag: chatTag,
      collapseKey: chatTag,
    },
  );
}

export async function respondToOffer(userId: string, messageId: string, status: string) {
  if (!["accepted", "rejected", "countered"].includes(status))
    throw createHttpError(400, "Invalid offer response");
  const { data: message } = await supabaseAdmin.from("community_messages")
    .select("conversation_id,sender_id,message_type").eq("id", messageId).single();
  if (!message || message.message_type !== "offer")
    throw createHttpError(404, "Offer not found");
  await assertParticipant(userId, message.conversation_id);
  if (message.sender_id === userId) throw createHttpError(400, "You cannot respond to your own offer");
  const { data, error } = await supabaseAdmin.from("community_messages")
    .update({ offer_status: status }).eq("id", messageId).select().single();
  if (error) throw createHttpError(500, error.message);
  return data;
}

export async function getUserProfile(userId: string, targetUserId: string) {
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, username, avatar_url, created_at")
    .eq("id", targetUserId)
    .single();
  
  if (userError || !user) {
    throw createHttpError(404, "User profile not found");
  }

  const [
    { count: followersCount, error: err1 },
    { count: followingCount, error: err2 },
    { count: postsCount, error: err3 },
    { data: isFollowingRow, error: err4 }
  ] = await Promise.all([
    supabaseAdmin.from("community_follows").select("*", { count: "exact", head: true }).eq("following_id", targetUserId),
    supabaseAdmin.from("community_follows").select("*", { count: "exact", head: true }).eq("follower_id", targetUserId),
    supabaseAdmin.from("community_listings").select("*", { count: "exact", head: true }).eq("seller_id", targetUserId).eq("status", "active"),
    supabaseAdmin.from("community_follows").select("id").eq("follower_id", userId).eq("following_id", targetUserId).maybeSingle()
  ]);

  if (err1 || err2 || err3 || err4) {
    throw createHttpError(500, "Error querying profile statistics");
  }

  return {
    ...user,
    followers_count: followersCount || 0,
    following_count: followingCount || 0,
    posts_count: postsCount || 0,
    is_following: !!isFollowingRow
  };
}
