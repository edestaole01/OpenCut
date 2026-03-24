import postgres from "postgres";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function migrate() {
  console.log("Criando tabelas da Fase 3...\n");

  await sql`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS description text`;
  console.log("✓ company_profiles.description");

  await sql`
    CREATE TABLE IF NOT EXISTS speakers (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      role text,
      linkedin text,
      instagram text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`;
  console.log("✓ speakers");

  await sql`
    CREATE TABLE IF NOT EXISTS generated_captions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clip_title text NOT NULL,
      platform text NOT NULL,
      caption text NOT NULL,
      hashtags text,
      score integer,
      transcript text,
      created_at timestamp NOT NULL DEFAULT now()
    )`;
  console.log("✓ generated_captions");

  await sql`
    CREATE TABLE IF NOT EXISTS hashtag_library (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tag text NOT NULL,
      category text,
      platform text,
      usage_count integer DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )`;
  console.log("✓ hashtag_library");

  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider text NOT NULL,
      model text NOT NULL,
      feature text NOT NULL,
      tokens_used integer,
      cost_usd text,
      created_at timestamp NOT NULL DEFAULT now()
    )`;
  console.log("✓ ai_usage_log");

  await sql.end();
  console.log("\n✅ Migração Fase 3 concluída!");
}

migrate().catch(e => { console.error("❌ Erro:", e.message); process.exit(1); });
