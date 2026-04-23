import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2";
import "dotenv/config";

const url = process.env.DATABASE_URL;
const conn = createConnection(url);
const db = drizzle(conn);

try {
  await db.execute("ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255)");
  console.log("Column added");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
    console.log("Column already exists");
  } else {
    console.error("Error:", e.message);
  }
}
conn.end();
