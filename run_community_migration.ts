import "dotenv/config";
import { Client } from "pg";
import fs from "fs";
import path from "path";

async function migrate() {
  const connectionString = process.env.SUPABASE_CONNECTION_STRING;
  if (!connectionString) throw new Error("Missing SUPABASE_CONNECTION_STRING");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, "community_schema.sql"), "utf8");
    await client.query(sql);
    console.log("Community marketplace migration completed.");
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error("Community marketplace migration failed:", error.message);
  process.exit(1);
});
