import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL 未配置");
  }
  if (!databaseUrl.startsWith("mysql://")) {
    throw new Error("db/seed.ts 仅支持 MySQL DATABASE_URL");
  }
  return databaseUrl;
}

async function seed() {
  const connection = await mysql.createConnection({
    uri: getDatabaseUrl(),
    timezone: "Z",
  });

  try {
    const [existingRows] = await connection.query(
      "SELECT id FROM users WHERE unionId = ? LIMIT 1",
      ["local_admin"],
    );
    const existing = existingRows as Array<{ id: number }>;

    if (existing.length > 0) {
      console.log("Admin user already exists, skipping seed.");
      return;
    }

    const passwordHash = await bcrypt.hash("admin123", 10);

    await connection.execute(
      `INSERT INTO users (unionId, name, department, email, role, passwordHash, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        "local_admin",
        "管理员",
        "管理部",
        "admin@example.com",
        "admin",
        passwordHash,
        "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
      ],
    );

    console.log("Seed completed: created default admin user.");
    console.log("Username: admin");
    console.log("Password: admin123");
  } finally {
    await connection.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
