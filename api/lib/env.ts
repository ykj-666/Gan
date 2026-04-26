import "dotenv/config";

export const env = {
  appId: process.env.APP_ID || "admin-app",
  appSecret: process.env.APP_SECRET || "default-secret-key-change-in-production",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL || "file:local.db",
  kimiAuthUrl: process.env.KIMI_AUTH_URL ?? "",
  kimiOpenUrl: process.env.KIMI_OPEN_URL ?? "",
  kimiApiKey: process.env.KIMI_API_KEY ?? "",
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};
