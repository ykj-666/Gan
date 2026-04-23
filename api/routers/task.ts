import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { tasks, activities } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const taskRouter = createRouter({
  list: publicQuery
    .input(
      z
        .object({
          status: z
            .enum(["todo", "in_progress", "review", "done"])
            .optional(),
          priority: z
            .enum(["low", "medium", "high", "urgent"])
            .optional(),
          assigneeId: z.number().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.status) {
        conditions.push(eq(tasks.status, input.status));
      }
      if (input?.priority) {
        conditions.push(eq(tasks.priority, input.priority));
      }
      if (input?.assigneeId) {
        conditions.push(eq(tasks.assigneeId, input.assigneeId));
      }

      let query;
      if (conditions.length > 0) {
        query = db
          .select()
          .from(tasks)
          .where(and(...conditions))
          .orderBy(desc(tasks.createdAt));
      } else {
        query = db
          .select()
          .from(tasks)
          .orderBy(desc(tasks.createdAt));
      }

      const result = await query;

      if (input?.search) {
        const searchLower = input.search.toLowerCase();
        return result.filter((t) =>
          t.title.toLowerCase().includes(searchLower)
        );
      }

      return result;
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);
      return result[0] ?? null;
    }),

  create: authedQuery
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        status: z
          .enum(["todo", "in_progress", "review", "done"])
          .default("todo"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .default("medium"),
        assigneeId: z.number().optional(),
        dueDate: z.string().optional(),
        tag: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const result = await db.insert(tasks).values({
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        creatorId: userId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        tag: input.tag,
      });

      const taskId = Number(result[0].insertId);

      await db.insert(activities).values({
        type: "task_created",
        description: `创建了任务 "${input.title}"`,
        userId,
        taskId,
      });

      return { id: taskId, ...input };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z
          .enum(["todo", "in_progress", "review", "done"])
          .optional(),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .optional(),
        assigneeId: z.number().optional(),
        dueDate: z.string().optional(),
        tag: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const { id, ...data } = input;

      const existing = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Task not found");
      }

      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.assigneeId !== undefined)
        updateData.assigneeId = data.assigneeId;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
      if (data.tag !== undefined) updateData.tag = data.tag;

      await db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id));

      if (data.status && data.status !== existing[0].status) {
        await db.insert(activities).values({
          type: "status_changed",
          description: `将任务 "${existing[0].title}" 状态从 ${existing[0].status} 改为 ${data.status}`,
          userId,
          taskId: id,
        });
      } else {
        await db.insert(activities).values({
          type: "task_updated",
          description: `更新了任务 "${existing[0].title}"`,
          userId,
          taskId: id,
        });
      }

      return { id, ...data };
    }),

  updateStatus: authedQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["todo", "in_progress", "review", "done"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const existing = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Task not found");
      }

      await db
        .update(tasks)
        .set({ status: input.status })
        .where(eq(tasks.id, input.id));

      await db.insert(activities).values({
        type: "status_changed",
        description: `将任务 "${existing[0].title}" 状态改为 ${input.status}`,
        userId,
        taskId: input.id,
      });

      return { id: input.id, status: input.status };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const existing = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .limit(1);

      if (!existing[0]) {
        throw new Error("Task not found");
      }

      await db.delete(tasks).where(eq(tasks.id, input.id));

      await db.insert(activities).values({
        type: "task_completed",
        description: `删除了任务 "${existing[0].title}"`,
        userId,
        taskId: input.id,
      });

      return { success: true };
    }),
});
