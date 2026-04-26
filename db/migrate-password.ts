import { sql } from "drizzle-orm";
import { getDb } from "../api/queries/connection";

const db = getDb();

async function migrate() {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255)`);
    console.log("passwordHash column added successfully");
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    if (
      err.code === "ER_DUP_FIELDNAME" ||
      err.code === "1060" ||
      err.message?.includes("Duplicate column")
    ) {
      console.log("passwordHash column already exists");
    } else {
      console.error("Migration error:", err.message);
    }
  }
}

migrate();
