import { supabaseAdmin } from "../../common/service/supabase.admin";
import { IHousehold, IHouseholdMember, IHouseholdWithMembers } from "./household.model";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

async function makeUniqueCode(): Promise<string> {
  let code = generateJoinCode();
  // Re-roll on collision (extremely rare)
  const { data } = await supabaseAdmin
    .from("households")
    .select("id")
    .eq("join_code", code)
    .maybeSingle();
  if (data) code = await makeUniqueCode();
  return code;
}

// ── Public service functions ──────────────────────────────────────────────────

/** Create a new household and add the creator as OWNER */
export const createHousehold = async (
  ownerId: string,
  name: string
): Promise<IHouseholdWithMembers> => {
  const joinCode = await makeUniqueCode();

  const { data: household, error: hErr } = await supabaseAdmin
    .from("households")
    .insert({ name: name.trim(), owner_id: ownerId, join_code: joinCode })
    .select()
    .single();

  if (hErr) throw new Error(hErr.message);

  const { error: mErr } = await supabaseAdmin
    .from("household_members")
    .insert({ household_id: household.id, user_id: ownerId, role: "OWNER" });

  if (mErr) throw new Error(mErr.message);

  return { ...household, members: [] };
};

/** Return the household the user currently belongs to, or null */
export const getMyHousehold = async (
  userId: string
): Promise<IHouseholdWithMembers | null> => {
  const { data: membership } = await supabaseAdmin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return null;

  const { data: household, error } = await supabaseAdmin
    .from("households")
    .select("*")
    .eq("id", membership.household_id)
    .single();

  if (error || !household) return null;

  const members = await getHouseholdMembers(household.id);
  return { ...household, members };
};

/** Return all members of a household (with username/avatar joined) */
export const getHouseholdMembers = async (
  householdId: string
): Promise<IHouseholdMember[]> => {
  const { data, error } = await supabaseAdmin
    .from("household_members")
    .select(`
      id,
      household_id,
      user_id,
      role,
      joined_at,
      users:user_id ( username, avatar_url )
    `)
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    household_id: row.household_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    username: row.users?.username || null,
    avatar_url: row.users?.avatar_url || null,
  }));
};

/** Join a household using a 6-char join code */
export const joinHousehold = async (
  userId: string,
  joinCode: string
): Promise<IHouseholdWithMembers> => {
  // Check not already in a household
  const { data: existing } = await supabaseAdmin
    .from("household_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    throw new Error("You are already a member of a household. Leave it first before joining another.");
  }

  const { data: household, error: hErr } = await supabaseAdmin
    .from("households")
    .select("*")
    .eq("join_code", joinCode.trim().toUpperCase())
    .maybeSingle();

  if (hErr || !household) throw new Error("Invalid join code. Please check and try again.");

  const { error: mErr } = await supabaseAdmin
    .from("household_members")
    .insert({ household_id: household.id, user_id: userId, role: "MEMBER" });

  if (mErr) throw new Error(mErr.message);

  const members = await getHouseholdMembers(household.id);
  return { ...household, members };
};

/** Leave a household. If owner leaves, the household is deleted (cascades members) */
export const leaveHousehold = async (userId: string): Promise<void> => {
  const { data: membership } = await supabaseAdmin
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("You are not a member of any household.");

  if (membership.role === "OWNER") {
    // Deleting the household will cascade to household_members
    const { error } = await supabaseAdmin
      .from("households")
      .delete()
      .eq("id", membership.household_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("household_members")
      .delete()
      .eq("user_id", userId)
      .eq("household_id", membership.household_id);
    if (error) throw new Error(error.message);
  }
};

/**
 * Returns the list of user IDs in the same household as the given user.
 * Returns [userId] if user has no household (fallback to self-only).
 * Used by product.service to expand inventory queries.
 */
export const getHouseholdMemberIds = async (userId: string): Promise<string[]> => {
  const { data: membership } = await supabaseAdmin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) return [userId];

  const { data: members } = await supabaseAdmin
    .from("household_members")
    .select("user_id")
    .eq("household_id", membership.household_id);

  return (members || []).map((m: any) => m.user_id);
};

/**
 * Returns the household_id for the given user, or null if not in a household.
 * Used by product.service when creating new products.
 */
export const getHouseholdIdForUser = async (userId: string): Promise<string | null> => {
  const { data } = await supabaseAdmin
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.household_id || null;
};
