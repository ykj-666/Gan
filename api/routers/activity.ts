import { and, desc, eq, gte, isNull, like, or } from "drizzle-orm";
import { z } from "zod";
import { activities, users } from "@db/schema";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";

const groupTypeMap = {
  all: [],
  task: ["task_created", "task_updated", "task_assigned", "task_deleted", "status_changed"],
  user: ["user_created", "user_updated", "user_deleted", "user_imported"],
  leave: ["leave_created", "leave_deleted", "leave_status_changed"],
  trip: ["trip_created", "trip_updated", "trip_deleted", "trip_imported"],
} as const;

export const activityRouter = createRouter({
  list: adminQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(500).default(20),
          search: z.string().optional(),
          typeGroup: z.enum(["all", "task", "user", "leave", "trip"]).default("all"),
          days: z.number().min(1).max(365).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 20;
      const typeGroup = input?.typeGroup ?? "all";
      const conditions = [isNull(activities.deletedAt), isNull(users.deletedAt)];

      if (typeGroup !== "all") {
        const matchedTypes = groupTypeMap[typeGroup];
        conditions.push(or(...matchedTypes.map((type) => eq(activities.type, type)))!);
      }

      if (input?.days) {
        const since = new Date();
        since.setDate(since.getDate() - input.days);
        conditions.push(gte(activities.createdAt, since));
      }

      if (input?.search?.trim()) {
        const keyword = `%${input.search.trim()}%`;
        conditions.push(
          or(like(activities.description, keyword), like(users.name, keyword))!,
        );
      }

      const query = db
        .select({
          id: activities.id,
          type: activities.type,
          description: activities.description,
          userId: activities.userId,
          taskId: activities.taskId,
          createdAt: activities.createdAt,
          actorName: users.name,
          actorDepartment: users.department,
        })
        .from(activities)
        .leftJoin(users, eq(users.id, activities.userId));

      if (conditions.length > 2) {
        return query.where(and(...conditions)).orderBy(desc(activities.createdAt)).limit(limit);
      }

      return query.where(and(...conditions)).orderBy(desc(activities.createdAt)).limit(limit);
    }),
});
