import "dotenv/config";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

    await client.query(`
      create table if not exists public.schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);
    const migrationsDir = path.join(__dirname, "../migrations");
    const filenames = fs.readdirSync(migrationsDir)
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    console.log("⏳ Running Migration...");
    for (const filename of filenames) {
      const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf-8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        "select checksum from public.schema_migrations where filename = $1",
        [filename],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration was modified: ${filename}`);
        }
        console.log(`Skipping applied migration: ${filename}`);
        continue;
      }
      console.log(`Running migration: ${filename}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations(filename, checksum) values ($1, $2)",
          [filename, checksum],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log("✨ Migration Completed Successfully!");
  } catch (err) {
    process.exitCode = 1;
    console.error("❌ Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
