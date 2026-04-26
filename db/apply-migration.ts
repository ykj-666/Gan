import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

async function main() {
  const client = createClient({ url: "file:local.db" });

  // Read and execute migration SQL
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
    console.log(`Applied migration: ${file}`);
  }

  // Seed admin user
  const existing = await client.execute({
    sql: "SELECT * FROM users WHERE unionId = ?",
    args: ["local_admin"],
  });

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await client.execute({
      sql: `INSERT INTO users (unionId, name, email, role, passwordHash, avatar, createdAt, updatedAt, lastSignInAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "local_admin",
        "管理员",
        "admin@example.com",
        "admin",
        passwordHash,
        "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
      ],
    });
    console.log("Created default admin user: admin / admin123");
  } else {
    console.log("Admin user already exists.");
  }

  client.close();
  console.log("Migration and seed completed.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
