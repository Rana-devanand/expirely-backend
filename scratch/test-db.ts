import dotenv from "dotenv";
import { supabaseAdmin } from "../app/common/service/supabase.admin";

dotenv.config();

async function main() {
  console.log("Fetching user locations from database...");
  const { data, error } = await supabaseAdmin
    .from("user_locations")
    .select("*")
    .limit(5);

  if (error) {
    console.error("❌ Error fetching user locations:", error.message);
  } else {
    console.log("✅ User locations:", data);
  }
}

main();
