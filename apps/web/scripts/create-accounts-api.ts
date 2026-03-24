import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BASE_URL = "http://localhost:3002";

async function createAccount(name: string, email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json() as any;

  if (res.ok) {
    return { success: true, user: data.user };
  } else if (data.code === "USER_ALREADY_EXISTS" || data.message?.includes("already")) {
    return { success: false, exists: true };
  } else {
    return { success: false, error: JSON.stringify(data) };
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log("🚀 Criando contas demo...\n");

    // Admin
    let adminResult = await createAccount("Admin", "admin@videoai.com", "admin123456");
    if (adminResult.success) {
      console.log("✓ Admin criado via API");
    } else if (adminResult.exists) {
      console.log("ℹ️  Admin já existe");
    } else {
      console.log("⚠️  Admin:", adminResult.error);
    }

    // Update admin role
    await client.query(`UPDATE users SET role = 'admin' WHERE email = 'admin@videoai.com'`);
    console.log("✓ Role 'admin' atribuído a admin@videoai.com");

    // User
    let userResult = await createAccount("Usuário Demo", "user@videoai.com", "user123456");
    if (userResult.success) {
      console.log("✓ Usuário demo criado via API");
    } else if (userResult.exists) {
      console.log("ℹ️  Usuário demo já existe");
    } else {
      console.log("⚠️  Usuário:", userResult.error);
    }

    console.log("\n✅ Contas prontas!\n");
    console.log("═══════════════════════════════════");
    console.log("🔑 Admin:   admin@videoai.com / admin123456");
    console.log("🔑 Usuário: user@videoai.com  / user123456");
    console.log("═══════════════════════════════════");
    console.log("\n🌐 Acesse: http://localhost:3002/login");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
