import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrateRole() {
  const client = await pool.connect();

  try {
    console.log("🔗 Conectando ao banco...");

    // Create enum if not exists
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('admin', 'user');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ Enum 'role' criado/verificado");

    // Add role column if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role role NOT NULL DEFAULT 'user';
    `);
    console.log("✓ Coluna 'role' adicionada à tabela users");

    // Create ai_configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        feature TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela 'ai_configs' criada/verificada");

    // Create company_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        industry TEXT,
        tone TEXT,
        target_audience TEXT,
        website TEXT,
        logo_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Tabela 'company_profiles' criada/verificada");

    console.log("\n✅ Migração concluída!");

  } catch (error) {
    console.error("❌ Erro:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateRole().catch(console.error);
