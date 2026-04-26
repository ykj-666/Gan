import "dotenv/config";
import { createClient } from "@libsql/client";
import mysql from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";

type TableConfig = {
  name: string;
  columns: string[];
};

const TABLES: TableConfig[] = [
  {
    name: "users",
    columns: [
      "id",
      "unionId",
      "name",
      "department",
      "email",
      "avatar",
      "role",
      "passwordHash",
      "createdAt",
      "updatedAt",
      "lastSignInAt",
      "deletedAt",
    ],
  },
  {
    name: "tasks",
    columns: [
      "id",
      "projectName",
      "projectCode",
      "projectType",
      "specialty",
      "projectManagerId",
      "assigneeId",
      "status",
      "priority",
      "plannedStartDate",
      "plannedEndDate",
      "estimatedHours",
      "remark",
      "creatorId",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    name: "activities",
    columns: [
      "id",
      "type",
      "description",
      "userId",
      "taskId",
      "before_json",
      "after_json",
      "ip_address",
      "user_agent",
      "createdAt",
      "deletedAt",
    ],
  },
  {
    name: "attendances",
    columns: [
      "id",
      "userId",
      "type",
      "startDate",
      "endDate",
      "days",
      "reason",
      "status",
      "approvedBy",
      "approvedAt",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  },
  {
    name: "business_trip",
    columns: [
      "id",
      "user_id",
      "employee_name",
      "department",
      "project_code",
      "cycle_start",
      "cycle_end",
      "dispatch_start",
      "dispatch_end",
      "location",
      "work_days",
      "actual_days",
      "office_days",
      "trip_days",
      "temp_days",
      "absence_days",
      "absence_reason",
      "subsidy_days",
      "remark",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
  },
  {
    name: "system_settings",
    columns: [
      "key",
      "value",
      "is_encrypted",
      "updated_by",
      "created_at",
      "updated_at",
    ],
  },
];

function getMysqlUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL 未配置");
  }
  if (!url.startsWith("mysql://")) {
    throw new Error("DATABASE_URL 必须是 mysql:// 连接串");
  }
  return url;
}

function getSqliteSourceUrl() {
  const sourceUrl = process.env.SQLITE_SOURCE_URL?.trim();
  if (!sourceUrl) {
    throw new Error("SQLITE_SOURCE_URL 未配置，请指向旧 SQLite/libSQL 数据库");
  }
  return sourceUrl;
}

async function ensureDatabaseExists(mysqlUrl: string) {
  const url = new URL(mysqlUrl);
  const databaseName = url.pathname.replace(/^\/+/, "");

  if (!databaseName) {
    throw new Error("DATABASE_URL 缺少数据库名");
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/";

  const connection = await mysql.createConnection({
    uri: adminUrl.toString(),
    timezone: "Z",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

function normalizeDateTimeValue(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const ts = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ts);
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeValue(column: string, value: unknown) {
  const dateTimeColumns = new Set([
    "createdAt",
    "updatedAt",
    "lastSignInAt",
    "deletedAt",
    "approvedAt",
    "created_at",
    "updated_at",
    "deleted_at",
  ]);

  if (dateTimeColumns.has(column)) {
    return normalizeDateTimeValue(value);
  }

  if (column === "is_encrypted") {
    return Boolean(value);
  }

  return value ?? null;
}

async function bootstrapMysql(mysqlUrl: string) {
  await ensureDatabaseExists(mysqlUrl);

  const connection = await mysql.createConnection({
    uri: mysqlUrl,
    timezone: "Z",
    multipleStatements: true,
  });

  try {
    const initSql = fs.readFileSync(path.join(process.cwd(), "db", "mysql-init.sql"), "utf-8");
    await connection.query(initSql);
  } finally {
    await connection.end();
  }
}

async function migrateTable(
  sqliteClient: ReturnType<typeof createClient>,
  mysqlConnection: mysql.Connection,
  table: TableConfig,
) {
  const selectSql = `SELECT ${table.columns.map((column) => `"${column}"`).join(", ")} FROM "${table.name}"`;
  const sourceRows = await sqliteClient.execute(selectSql);

  if (sourceRows.rows.length === 0) {
    console.log(`[migrate] ${table.name}: 0 rows`);
    return;
  }

  const columnsSql = table.columns.map((column) => `\`${column}\``).join(", ");
  const placeholdersSql = table.columns.map(() => "?").join(", ");
  const updateSql = table.columns
    .filter((column) => column !== "id" && column !== "key")
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(", ");

  const insertSql = `INSERT INTO \`${table.name}\` (${columnsSql}) VALUES (${placeholdersSql}) ON DUPLICATE KEY UPDATE ${updateSql}`;

  for (const row of sourceRows.rows as Record<string, unknown>[]) {
    const values = table.columns.map((column) => normalizeValue(column, row[column])) as Array<
      string | number | boolean | Date | null
    >;
    await mysqlConnection.execute(insertSql, values);
  }

  console.log(`[migrate] ${table.name}: ${sourceRows.rows.length} rows`);
}

async function main() {
  const mysqlUrl = getMysqlUrl();
  const sqliteSourceUrl = getSqliteSourceUrl();

  await bootstrapMysql(mysqlUrl);

  const sqliteClient = createClient({ url: sqliteSourceUrl });
  const mysqlConnection = await mysql.createConnection({
    uri: mysqlUrl,
    timezone: "Z",
  });

  try {
    await mysqlConnection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of TABLES) {
      await migrateTable(sqliteClient, mysqlConnection, table);
    }

    await mysqlConnection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("[migrate] SQLite -> MySQL completed");
  } finally {
    await mysqlConnection.end();
    sqliteClient.close();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
