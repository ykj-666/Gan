import { getDb } from "../api/queries/connection";

async function test() {
  const db = getDb();
  const result = await db.insert(db._.fullSchema.tasks).values({
    projectName: "测试插入",
    projectCode: "TEST",
    status: "todo",
    priority: "medium",
    creatorId: 1,
  });
  console.log("Result type:", typeof result);
  console.log("Result:", JSON.stringify(result, null, 2));
  if (Array.isArray(result)) {
    console.log("Is array, length:", result.length);
    console.log("First item:", result[0]);
  }
}

test().catch(console.error);
