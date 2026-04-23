import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { activities } from "@db/schema";
import { desc } from "drizzle-orm";

export const activityRouter = createRouter({
  list: publicQuery
    .input(
      z
        .object({
          limit: z.number().default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 20;
      return db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(limit);
    }),
});
