import "dotenv/config";
import { Client } from "pg";

async function migrate() {
  const connectionString = process.env.SUPABASE_CONNECTION_STRING;

  if (!connectionString) {
    console.error("❌ Missing SUPABASE_CONNECTION_STRING");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("🚀 Connecting to Supabase Database...");
    await client.connect();
    console.log("✅ Connected successfully!");

    console.log("⏳ Adding opt_out column...");
    await client.query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS opt_out BOOLEAN DEFAULT false;");
    console.log("✨ Migration Completed Successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
