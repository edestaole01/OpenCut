import { Pool } from "pg";
import * as dotenv from "dotenv";
import { randomBytes, scryptSync } from "crypto";

dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function generateId() {
  return randomBytes(16).toString("hex");
}

// Better-auth uses oslo/password which uses scrypt
// Better-auth compatible scrypt hash
async function hashPasswordBetterAuth(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64");
  // Use smaller N to avoid memory issues; better-auth default is N=16384
  const N = 4096, r = 8, p = 1;
  const keyLen = 32;
  const hash = scryptSync(password, salt, keyLen, { N, r, p });
  return `$scrypt$N=${N},r=${r},p=${p}$${salt}$${hash.toString("base64")}`;
}

async function seedUsers() {
  const client = await pool.connect();

  try {
    console.log("🔗 Conectando ao banco...");
    const now = new Date();

    // Create Admin user
    const adminId = generateId();
    const adminPassword = await hashPasswordBetterAuth("admin123456");
    const accountAdminId = generateId();

    // Check if admin already exists
    const existingAdmin = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      ["admin@videoai.com"]
    );

    if (existingAdmin.rows.length === 0) {
      await client.query(
        `INSERT INTO users (id, name, email, email_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, "Admin", "admin@videoai.com", true, "admin", now, now]
      );

      await client.query(
        `INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [accountAdminId, adminId, "credential", adminId, adminPassword, now, now]
      );
      console.log("✓ Admin criado: admin@videoai.com / admin123456");
    } else {
      // Update role to admin
      await client.query(
        `UPDATE users SET role = 'admin' WHERE email = $1`,
        ["admin@videoai.com"]
      );
      console.log("ℹ️  Admin já existe, role atualizado para admin");
    }

    // Create Demo User
    const userId = generateId();
    const userPassword = await hashPasswordBetterAuth("user123456");
    const accountUserId = generateId();

    const existingUser = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      ["user@videoai.com"]
    );

    if (existingUser.rows.length === 0) {
      await client.query(
        `INSERT INTO users (id, name, email, email_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, "Usuário Demo", "user@videoai.com", true, "user", now, now]
      );

      await client.query(
        `INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [accountUserId, userId, "credential", userId, userPassword, now, now]
      );
      console.log("✓ Usuário criado: user@videoai.com / user123456");
    } else {
      console.log("ℹ️  Usuário demo já existe");
    }

    console.log("\n✅ Contas demo prontas!\n");
    console.log("═══════════════════════════════════");
    console.log("🔑 Login Admin:   admin@videoai.com");
    console.log("🔑 Senha Admin:   admin123456");
    console.log("───────────────────────────────────");
    console.log("🔑 Login Usuário: user@videoai.com");
    console.log("🔑 Senha Usuário: user123456");
    console.log("═══════════════════════════════════");

  } catch (error) {
    console.error("❌ Erro:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch(console.error);
