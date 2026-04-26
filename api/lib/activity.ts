import { activities } from "@db/schema";
import type { getDb } from "../queries/connection";

type DbClient = ReturnType<typeof getDb>;

type ActivityType = (typeof activities.$inferInsert)["type"];

export async function createActivity(
  db: DbClient,
  input: {
    type: ActivityType;
    description: string;
    userId?: number | null;
    taskId?: number | null;
  },
) {
  await db.insert(activities).values({
    type: input.type,
    description: input.description,
    userId: input.userId ?? null,
    taskId: input.taskId ?? null,
  });
}
