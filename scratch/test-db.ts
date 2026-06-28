import dotenv from "dotenv";
import { supabaseAdmin } from "../app/common/service/supabase.admin";

dotenv.config();

async function main() {
  const targetEmail = "dev.cloudapp93@gmail.com";
  console.log("Checking user in Supabase:", targetEmail);
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, email, username, opt_out")
    .eq("email", targetEmail);

  if (error) {
    console.error("❌ Error fetching user:", error.message);
  } else {
    console.log("✅ Users found:", users);
  }
}

main();
