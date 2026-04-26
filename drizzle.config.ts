import { loadAppEnv } from "./load-env";
import { defineConfig } from "drizzle-kit";

loadAppEnv();

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL 未配置，无法生成 MySQL Drizzle 配置。请检查 .env、.env.local 或 .env.production.local。",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl,
  },
});
