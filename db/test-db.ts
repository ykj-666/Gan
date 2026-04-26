import { getDb } from "../api/queries/connection";

async function test() {
  try {
    const db = getDb();
    const users = await db.query.users.findMany();
    console.log("Users:", users);

    const result = await db.insert(db._.fullSchema.tasks).values({
      projectName: "测试项目",
      projectCode: "P001",
      projectType: "建筑设计",
      specialty: "建筑",
      projectManagerId: 1,
      assigneeId: 1,
      status: "todo",
      priority: "high",
      plannedStartDate: "2026-04-23",
      plannedEndDate: "2026-05-01",
      estimatedHours: 40,
      remark: "测试",
      creatorId: 1,
    });
    console.log("Insert result:", result);

    const tasks = await db.query.tasks.findMany();
    console.log("Tasks:", tasks);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
