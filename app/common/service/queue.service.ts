import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.SUPABASE_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(
    "SUPABASE_CONNECTION_STRING is missing from environment variables.",
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase external connections
  },
});

export class QueueService {
  private queueName = "notifications_queue";

  constructor() {
    this.initQueue();
  }

  private async initQueue() {
    try {
      // Create the queue if it doesn't exist using pgmq extension
      await pool
        .query(`SELECT pgmq.create('${this.queueName}');`)
        .catch((err) => {
          // Ignore if already exists error
          if (!err.message.includes("already exists")) {
            console.error("Error creating queue:", err);
          }
        });
      console.log(`✅ Supabase Queue '${this.queueName}' ready.`);
    } catch (error) {
      console.error("Failed to initialize PGMQ:", error);
    }
  }

  async send(message: any) {
    const query = `SELECT * FROM pgmq.send('${this.queueName}', $1::jsonb);`;
    const { rows } = await pool.query(query, [JSON.stringify(message)]);
    return rows[0];
  }

  async read(vt: number = 30) {
    const query = `SELECT * FROM pgmq.read('${this.queueName}', $1, 1);`;
    const { rows } = await pool.query(query, [vt]);
    return rows.length > 0 ? rows[0] : null;
  }

  async archive(msgId: number) {
    const query = `SELECT * FROM pgmq.archive('${this.queueName}', $1);`;
    await pool.query(query, [msgId]);
  }

  async delete(msgId: number) {
    const query = `SELECT * FROM pgmq.delete('${this.queueName}', $1);`;
    await pool.query(query, [msgId]);
  }
}

export const queueService = new QueueService();
