require("../load-env.cjs").loadAppEnv(process.env.NODE_ENV || "production");

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

function getDatabaseUrl() {
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is missing. Set a mysql:// connection string in .env, .env.local, or .env.production.local.",
    );
  }
  if (!databaseUrl.startsWith("mysql://")) {
    throw new Error("db/apply-migration.cjs only supports MySQL DATABASE_URL");
  }
  return databaseUrl;
}

function getMysqlConfig() {
  const databaseUrl = new URL(getDatabaseUrl());
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "");

  if (!databaseName) {
    throw new Error("DATABASE_URL is missing a database name");
  }

  return { databaseUrl, databaseName };
}

async function canConnectToTargetDatabase(databaseUrl) {
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

  let connection = null;

  try {
    connection = await mysql.createConnection({
      uri: adminUrl.toString(),
      timezone: "Z",
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    const code = error && error.code;

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

async function main() {
  await ensureDatabaseExists();

  const connection = await mysql.createConnection({
    uri: getDatabaseUrl(),
    timezone: "Z",
    multipleStatements: true,
  });

  try {
    const initSql = fs.readFileSync(path.join(process.cwd(), "db", "mysql-init.sql"), "utf-8");
    await connection.query(initSql);

    const [existing] = await connection.query(
      "SELECT id FROM users WHERE unionId = ? LIMIT 1",
      ["local_admin"],
    );

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
      console.log("Created default admin user: admin / admin123");
    } else {
      console.log("Admin user already exists.");
    }
  } finally {
    await connection.end();
  }

  console.log("MySQL bootstrap completed.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
