import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import { getDatabaseUrl } from "./database-url";

function getMysqlConfig() {
  const databaseUrl = new URL(getDatabaseUrl());
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "");

  if (!databaseName) {
    throw new Error("DATABASE_URL missing database name, cannot initialize MySQL");
  }

  return { databaseUrl, databaseName };
}

async function canConnectToTargetDatabase(databaseUrl: string) {
  try {
    const connection = await mysql.createConnection({
      uri: databaseUrl,
      timezone: "Z",
    });

    try {
      await connection.query("SELECT 1");
      return true;
    } finally {
      await connection.end();
    }
  } catch {
    return false;
  }
}

async function ensureDatabaseExists() {
  const { databaseUrl, databaseName } = getMysqlConfig();
  const targetUrl = databaseUrl.toString();
  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = "/";

  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      uri: adminUrl.toString(),
      timezone: "Z",
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (
      (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_DBACCESS_DENIED_ERROR") &&
      (await canConnectToTargetDatabase(targetUrl))
    ) {
      return;
    }

    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function initDatabase() {
  await ensureDatabaseExists();

  const connection = await mysql.createConnection({
    uri: getDatabaseUrl(),
    timezone: "Z",
    multipleStatements: true,
  });

  try {
    const initSql = fs.readFileSync(path.join(process.cwd(), "db", "mysql-init.sql"), "utf-8");
    await connection.query(initSql);

    const [existingRows] = await connection.query(
      "SELECT id FROM users WHERE unionId = ? LIMIT 1",
      ["local_admin"],
    );
    const existing = existingRows as Array<{ id: number }>;

    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await connection.execute(
        `INSERT INTO users (unionId, name, department, email, role, passwordHash, avatar)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "local_admin",
          "Admin",
          "System",
          "admin@example.com",
          "admin",
          passwordHash,
          "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        ],
      );
      console.log("[DB] Created default admin user: admin / admin123");
    } else {
      console.log("[DB] Admin user already exists.");
    }
  } finally {
    await connection.end();
  }
}
