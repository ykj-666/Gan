const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

async function main() {
  const dbPath = path.join(process.cwd(), "local.db");
  const client = createClient({ url: `file:${dbPath}` });

  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await client.execute(statement);
      } catch (err) {
        const message = err?.message || "";
        if (
          message.includes("already exists") ||
          message.includes("duplicate column name")
        ) {
          console.log(`[跳过] ${message}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`Applied migration: ${file}`);
  }

  const existing = await client.execute({
    sql: "SELECT * FROM users WHERE unionId = ?",
    args: ["local_admin"],
  });

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO users (unionId, name, department, email, role, passwordHash, avatar, createdAt, updatedAt, lastSignInAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "local_admin",
        "管理员",
        "管理部",
        "admin@example.com",
        "admin",
        passwordHash,
        "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        now,
        now,
        now,
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
