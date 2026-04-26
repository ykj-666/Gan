import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

function isIgnorableMigrationError(message: string) {
  return (
    message.includes("already exists") ||
    message.includes("duplicate column name")
  );
}

export async function initDatabase() {
  const dbPath = path.join(process.cwd(), "local.db");
  const client = createClient({ url: `file:${dbPath}` });

  try {
    // Repair very old attendance schema before standard migrations run.
    try {
      const columns = await client.execute("PRAGMA table_info(attendances)");
      const hasStartDate = columns.rows.some((row: any) => row.name === "startDate");
      if (!hasStartDate) {
        console.log("[DB] Old or broken attendances table detected, dropping...");
        await client.execute("DROP TABLE IF EXISTS attendances");
      }
    } catch {
      // Table absent is acceptable.
    }

    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    const deprecatedMigrations = ["0002_update_attendance.sql"];

    for (const file of deprecatedMigrations) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`[DB] Removing deprecated migration file: ${file}`);
        fs.unlinkSync(filePath);
      }
    }

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
        } catch (error: any) {
          const message = error?.message || "";
          if (isIgnorableMigrationError(message)) {
            console.log(`[DB] Skip: ${message}`);
          } else {
            throw error;
          }
        }
      }

      console.log(`[DB] Applied migration: ${file}`);
    }

    const existing = await client.execute({
      sql: "SELECT 1 FROM users WHERE unionId = ? LIMIT 1",
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
      console.log("[DB] Created default admin user: admin / admin123");
    } else {
      console.log("[DB] Admin user already exists.");
    }
  } finally {
    client.close();
  }
}
