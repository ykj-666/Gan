import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { tasks, users } from "@db/schema";
import { createActivity } from "../lib/activity";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";

const taskStatusLabelMap = {
  todo: "待处理",
  in_progress: "进行中",
  review: "审核中",
  done: "已完成",
} as const;

const taskInputSchema = z.object({
  projectName: z.string().min(1),
  projectCode: z.string().optional(),
  projectType: z.string().optional(),
  specialty: z.string().optional(),
  projectManagerId: z.number().optional(),
  assigneeId: z.number().optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  remark: z.string().optional(),
});

type TaskListRow = Awaited<ReturnType<typeof selectTaskRows>>[number];

async function selectTaskRows(input?: {
  status?: "todo" | "in_progress" | "review" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assigneeId?: number;
  search?: string;
}) {
  const db = getDb();
  const conditions = [];

  if (input?.status) conditions.push(eq(tasks.status, input.status));
  if (input?.priority) conditions.push(eq(tasks.priority, input.priority));
  if (input?.assigneeId) conditions.push(eq(tasks.assigneeId, input.assigneeId));

  const rawTasks =
    conditions.length > 0
      ? await db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt))
      : await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  const relatedUserIds = Array.from(
    new Set(
      rawTasks
        .flatMap((task) => [task.assigneeId, task.projectManagerId, task.creatorId])
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  const relatedUsers =
    relatedUserIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
          })
          .from(users)
          .where(inArray(users.id, relatedUserIds))
      : [];

  const userNameById = new Map(relatedUsers.map((user) => [user.id, user.name?.trim() || null]));

  const rows = rawTasks.map((task) => ({
    ...task,
    assigneeName: task.assigneeId ? userNameById.get(task.assigneeId) ?? null : null,
    projectManagerName: task.projectManagerId
      ? userNameById.get(task.projectManagerId) ?? null
      : null,
    creatorName: userNameById.get(task.creatorId) ?? null,
  }));

  const keyword = input?.search?.trim().toLowerCase();
  if (!keyword) return rows;

  return rows.filter((task) => {
    return (
      task.projectName.toLowerCase().includes(keyword) ||
      (task.projectCode?.toLowerCase().includes(keyword) ?? false) ||
      (task.assigneeName?.toLowerCase().includes(keyword) ?? false) ||
      (task.projectManagerName?.toLowerCase().includes(keyword) ?? false)
    );
  });
}

export const taskRouter = createRouter({
  list: adminQuery
    .input(
      z
        .object({
          status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
          priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
          assigneeId: z.number().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => selectTaskRows(input)),

  getById: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const rows = await selectTaskRows();
      return rows.find((task) => task.id === input.id) ?? null;
    }),

  create: adminQuery.input(taskInputSchema).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    const result = await db.insert(tasks).values({
      projectName: input.projectName.trim(),
      projectCode: input.projectCode?.trim() || null,
      projectType: input.projectType?.trim() || null,
      specialty: input.specialty?.trim() || null,
      projectManagerId: input.projectManagerId,
      assigneeId: input.assigneeId,
      status: input.status,
      priority: input.priority,
      plannedStartDate: input.plannedStartDate || null,
      plannedEndDate: input.plannedEndDate || null,
      estimatedHours: input.estimatedHours,
      remark: input.remark?.trim() || null,
      creatorId: userId,
    });

    const taskId = Number(result.lastInsertRowid);

    await createActivity(db, {
      type: "task_created",
      description: `创建了任务「${input.projectName.trim()}」`,
      userId,
      taskId,
    });

    return { id: taskId, ...input };
  }),

  update: adminQuery
    .input(taskInputSchema.partial().extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const { id, ...data } = input;

      const existing = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
      if (!existing[0]) {
        throw new Error("Task not found");
      }

      const updateData: Record<string, unknown> = {};
      if (data.projectName !== undefined) updateData.projectName = data.projectName.trim();
      if (data.projectCode !== undefined) updateData.projectCode = data.projectCode?.trim() || null;
      if (data.projectType !== undefined) updateData.projectType = data.projectType?.trim() || null;
      if (data.specialty !== undefined) updateData.specialty = data.specialty?.trim() || null;
      if (data.projectManagerId !== undefined) updateData.projectManagerId = data.projectManagerId;
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.plannedStartDate !== undefined) updateData.plannedStartDate = data.plannedStartDate || null;
      if (data.plannedEndDate !== undefined) updateData.plannedEndDate = data.plannedEndDate || null;
      if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
      if (data.remark !== undefined) updateData.remark = data.remark?.trim() || null;

      await db.update(tasks).set(updateData).where(eq(tasks.id, id));

      if (data.status && data.status !== existing[0].status) {
        await createActivity(db, {
          type: "status_changed",
          description: `将任务「${existing[0].projectName}」状态改为${taskStatusLabelMap[data.status]}`,
          userId,
          taskId: id,
        });
      } else {
        await createActivity(db, {
          type: "task_updated",
          description: `更新了任务「${existing[0].projectName}」`,
          userId,
          taskId: id,
        });
      }

      return { id, ...data };
    }),

  updateStatus: adminQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["todo", "in_progress", "review", "done"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const existing = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);

      if (!existing[0]) {
        throw new Error("Task not found");
      }

      await db.update(tasks).set({ status: input.status }).where(eq(tasks.id, input.id));

      await createActivity(db, {
        type: "status_changed",
        description: `将任务「${existing[0].projectName}」状态改为${taskStatusLabelMap[input.status]}`,
        userId,
        taskId: input.id,
      });

      return { id: input.id, status: input.status };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const existing = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);

      if (!existing[0]) {
        throw new Error("Task not found");
      }

      await db.delete(tasks).where(eq(tasks.id, input.id));

      await createActivity(db, {
        type: "task_completed",
        description: `删除了任务「${existing[0].projectName}」`,
        userId,
        taskId: input.id,
      });

      return { success: true };
    }),
});

export type { TaskListRow };
