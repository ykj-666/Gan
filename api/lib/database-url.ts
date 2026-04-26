import { env } from "./env";

export function getDatabaseUrl() {
  const configured = env.databaseUrl.trim();

  if (!configured) {
    throw new Error(
      "DATABASE_URL 未配置。请在 .env、.env.local 或 .env.production.local 中设置 MySQL 连接串后再启动服务。",
    );
  }

  if (!configured.startsWith("mysql://")) {
    throw new Error("当前版本仅支持 MySQL，请将 DATABASE_URL 配置为 mysql:// 连接串。");
  }

  return configured;
}
