import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.SUPABASE_CONNECTION_STRING;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

const requirePool = () => {
  if (!pool) {
    throw new Error(
      "SUPABASE_CONNECTION_STRING is missing from environment variables.",
    );
  }
  return pool;
};

export class QueueService {
  private queueName = "notifications_queue";
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (!pool) {
      console.warn("Notification queue disabled: connection string is missing.");
      return false;
    }

    try {
      try {
        await pool.query(`SELECT pgmq.create('${this.queueName}');`);
      } catch (error: any) {
        const message = error?.message || "";
        if (
          !message.includes("already exists") &&
          !message.includes("already a member")
        ) {
          throw error;
        }
      }

      this.initialized = true;
      console.log(`Supabase Queue '${this.queueName}' ready.`);
      return true;
    } catch (error) {
      console.error(
        "Notification queue unavailable. Configure an IPv4-compatible Supabase Session Pooler URL:",
        error,
      );
      return false;
    }
  }

  async send(message: any) {
    const query = `SELECT * FROM pgmq.send('${this.queueName}', $1::jsonb);`;
    const { rows } = await requirePool().query(query, [JSON.stringify(message)]);
    return rows[0];
  }

  async read(vt: number = 30) {
    const query = `SELECT * FROM pgmq.read('${this.queueName}', $1::integer, 1);`;
    const { rows } = await requirePool().query(query, [vt]);
    return rows.length > 0 ? rows[0] : null;
  }

  async archive(msgId: number) {
    const query = `SELECT * FROM pgmq.archive('${this.queueName}', $1::bigint);`;
    await requirePool().query(query, [msgId]);
  }

  async delete(msgId: number) {
    const query = `SELECT * FROM pgmq.delete('${this.queueName}', $1::bigint);`;
    await requirePool().query(query, [msgId]);
  }
}

export const queueService = new QueueService();
