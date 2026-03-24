import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM accounts WHERE user_id IN (SELECT id FROM users WHERE email IN ('admin@videoai.com', 'user@videoai.com'))`);
    await client.query(`DELETE FROM users WHERE email IN ('admin@videoai.com', 'user@videoai.com')`);
    console.log("✓ Usuários de teste removidos do banco");
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(console.error);
