import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as path from "path";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const dbPath = path.join(process.cwd(), "local.db");
    const client = createClient({ url: `file:${dbPath}` });
    instance = drizzle(client, { schema: fullSchema });
  }
  return instance;
}
