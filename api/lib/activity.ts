import { activities } from "@db/schema";
import type { getDb } from "../queries/connection";

type DbLike = { insert: ReturnType<typeof getDb>["insert"] };

type ActivityType = (typeof activities.$inferInsert)["type"];

export async function createActivity(
  db: DbLike,
  input: {
    type: ActivityType;
    description: string;
    userId?: number | null;
    taskId?: number | null;
    beforeJson?: Record<string, unknown> | null;
    afterJson?: Record<string, unknown> | null;
    req?: Request | null;
  },
) {
  const ipAddress = input.req
    ? (input.req.headers.get("x-forwarded-for") ||
       input.req.headers.get("x-real-ip") ||
       input.req.headers.get("cf-connecting-ip") ||
       "unknown")
    : null;
  const userAgent = input.req?.headers.get("user-agent") || null;

  await db.insert(activities).values({
    type: input.type,
    description: input.description,
    userId: input.userId ?? null,
    taskId: input.taskId ?? null,
    beforeJson: input.beforeJson ? JSON.stringify(input.beforeJson) : null,
    afterJson: input.afterJson ? JSON.stringify(input.afterJson) : null,
    ipAddress,
    userAgent,
  });
}
