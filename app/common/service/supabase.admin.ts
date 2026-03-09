import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } },
);

// Connection check

export const testSupabaseConnection = async () => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Supabase Connection Failed:", error.message);
  } else {
    console.log("✅ Supabase Connected Successfully");
  }
};
