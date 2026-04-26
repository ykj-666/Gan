import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  const client = createClient({ url: "file:local.db" });
  const db = drizzle(client);

  // Check if admin already exists
  const existing = await db.select().from(users).where(eq(users.unionId, "local_admin"));
  if (existing.length > 0) {
    console.log("Admin user already exists, skipping seed.");
    client.close();
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  await db.insert(users).values({
    unionId: "local_admin",
    name: "管理员",
    email: "admin@example.com",
    role: "admin",
    passwordHash,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin`,
  });

  console.log("Seed completed: created default admin user.");
  console.log("Username: admin");
  console.log("Password: admin123");
  client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
