import "dotenv/config";
import { supabase } from "../app/config/supabase";

async function run() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .ilike("message", "%tomorrow%")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notifications:", error);
    return;
  }

  console.log("Notifications containing 'tomorrow' in DB:");
  console.log(JSON.stringify(data, null, 2));
}

run();
