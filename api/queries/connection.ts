import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "@db/schema";
import * as relations from "@db/relations";
import { getDatabaseUrl } from "../lib/database-url";

const fullSchema = { ...schema, ...relations };

function createDb() {
  const pool = mysql.createPool({
    uri: getDatabaseUrl(),
    connectionLimit: 10,
    timezone: "Z",
  });

  return drizzle(pool, { schema: fullSchema, mode: "default" });
}

let instance: ReturnType<typeof createDb>;

export function getDb() {
  if (!instance) {
    instance = createDb();
  }

  return instance;
}
