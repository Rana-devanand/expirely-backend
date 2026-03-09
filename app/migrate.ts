import "dotenv/config";
import { Client } from "pg";
import fs from "fs";
import path from "path";

async function migrate() {
  const connectionString = process.env.SUPABASE_CONNECTION_STRING;

  if (!connectionString) {
    console.error("❌ Missing SUPABASE_CONNECTION_STRING");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Necessary for Supabase SSL
  });

  try {
    console.log("🚀 Connecting to Supabase Database...");
    await client.connect();
    console.log("✅ Connected successfully!");

    const sqlPath = path.join(__dirname, "../supabase_schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("⏳ Running Migration...");
    await client.query(sql);
    console.log("✨ Migration Completed Successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
