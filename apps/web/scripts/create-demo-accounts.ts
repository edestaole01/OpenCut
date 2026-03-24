import { Pool } from "pg";
import * as dotenv from "dotenv";
import { createHash, randomBytes } from "crypto";

dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Simple password hashing compatible with better-auth (bcrypt-like via SHA256 for demo)
// Better-auth uses scrypt by default. Let's use the better-auth API instead.
// We'll create users via HTTP API call to our running server.

async function hashPassword(password: string): Promise<string> {
  // Better-auth uses scrypt. We'll use a compatible hash.
  // For simplicity, we'll call the register endpoint via the API
  const salt = randomBytes(16).toString("hex");
  return `sha256:${salt}:${createHash("sha256").update(salt + password).digest("hex")}`;
}

async function createDemoAccounts() {
  console.log("🚀 Criando contas demo via API...\n");

  // Create admin account
  try {
    const adminRes = await fetch("http://localhost:3001/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Admin",
        email: "admin@videoai.com",
        password: "admin123456",
      }),
    });
    const adminData = await adminRes.json();
    if (adminRes.ok) {
      console.log("✓ Conta admin criada: admin@videoai.com");

      // Set role to admin
      const client = await pool.connect();
      await client.query(`UPDATE users SET role = 'admin' WHERE email = 'admin@videoai.com'`);
      client.release();
      console.log("✓ Role 'admin' definido para admin@videoai.com");
    } else {
      if (adminData.message?.includes("already exists") || adminData.code === "USER_ALREADY_EXISTS") {
        console.log("ℹ️  Admin já existe, atualizando role...");
        const client = await pool.connect();
        await client.query(`UPDATE users SET role = 'admin' WHERE email = 'admin@videoai.com'`);
        client.release();
        console.log("✓ Role 'admin' atualizado");
      } else {
        console.log("⚠️  Admin:", JSON.stringify(adminData));
      }
    }
  } catch (e) {
    console.log("⚠️  Erro ao criar admin:", e);
  }

  // Create regular user account
  try {
    const userRes = await fetch("http://localhost:3001/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Usuário Demo",
        email: "user@videoai.com",
        password: "user123456",
      }),
    });
    const userData = await userRes.json();
    if (userRes.ok) {
      console.log("✓ Conta usuário criada: user@videoai.com");
    } else {
      if (userData.message?.includes("already exists") || userData.code === "USER_ALREADY_EXISTS") {
        console.log("ℹ️  Usuário demo já existe");
      } else {
        console.log("⚠️  Usuário:", JSON.stringify(userData));
      }
    }
  } catch (e) {
    console.log("⚠️  Erro ao criar usuário:", e);
  }

  await pool.end();
  console.log("\n✅ Contas demo prontas!");
  console.log("\n📧 Admin: admin@videoai.com | Senha: admin123456");
  console.log("📧 Usuário: user@videoai.com | Senha: user123456");
}

createDemoAccounts().catch(console.error);
