import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { attendances, users } from "@db/schema";
import { createActivity } from "../lib/activity";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";

const leaveStatusLabelMap = {
  pending: "待处理",
  approved: "已确认",
  rejected: "已驳回",
} as const;

const leaveInputSchema = z.object({
  userId: z.number(),
  type: z.enum(["sick", "annual", "personal", "marriage", "maternity", "other"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  days: z.number().min(0.5).max(365).optional(),
  reason: z.string().max(2000).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

function validateLeaveRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "开始日期和结束日期不能为空",
    });
  }

  if (startDate > endDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "结束日期不能早于开始日期",
    });
  }
}

async function getUserInfo(db: ReturnType<typeof getDb>, userId: number) {
  const matched = await db
    .select({
      id: users.id,
      name: users.name,
      department: users.department,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return matched[0] ?? null;
}

export const attendanceRouter = createRouter({
  create: adminQuery.input(leaveInputSchema).mutation(async ({ input, ctx }) => {
    const db = getDb();
    validateLeaveRange(input.startDate, input.endDate);

    const matchedUser = await getUserInfo(db, input.userId);
    if (!matchedUser) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "员工不存在，请重新选择",
      });
    }

    const result = await db.transaction(async (tx) => {
      const insertResult = await tx.insert(attendances).values({
        userId: input.userId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        days: input.days ?? null,
        reason: input.reason?.trim() || null,
        status: input.status ?? "approved",
      });

      await createActivity(tx, {
        type: "leave_created",
        description: `新增了员工「${matchedUser.name ?? input.userId}」的请假记录`,
        userId: ctx.user.id,
        req: ctx.req,
      });

      return Number(insertResult.lastInsertRowid);
    });

    return { id: result, ...input };
  }),

  update: adminQuery
    .input(leaveInputSchema.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      validateLeaveRange(input.startDate, input.endDate);

      const matchedUser = await getUserInfo(db, input.userId);
      if (!matchedUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "员工不存在，请重新选择",
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(attendances)
          .set({
            userId: input.userId,
            type: input.type,
            startDate: input.startDate,
            endDate: input.endDate,
            days: input.days ?? null,
            reason: input.reason?.trim() || null,
            status: input.status ?? "approved",
          })
          .where(eq(attendances.id, input.id));

        await createActivity(tx, {
          type: "leave_status_changed",
          description: `更新了员工「${matchedUser.name ?? input.userId}」的请假记录`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { success: true };
    }),

  list: adminQuery
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(attendances.deletedAt)];

      if (input.userId) {
        conditions.push(eq(attendances.userId, input.userId));
      }

      if (input.startDate) {
        conditions.push(gte(attendances.endDate, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(attendances.startDate, input.endDate));
      }

      const rows =
        conditions.length > 1
          ? await db
              .select()
              .from(attendances)
              .where(and(...conditions))
              .orderBy(desc(attendances.createdAt))
          : await db
              .select()
              .from(attendances)
              .where(conditions[0])
              .orderBy(desc(attendances.createdAt));

      const userIds = Array.from(
        new Set(rows.map((row) => row.userId).filter((value) => typeof value === "number")),
      );

      const relatedUsers =
        userIds.length > 0
          ? await db
              .select({
                id: users.id,
                name: users.name,
                department: users.department,
              })
              .from(users)
              .where(and(inArray(users.id, userIds), isNull(users.deletedAt)))
          : [];

      const userById = new Map(relatedUsers.map((user) => [user.id, user]));

      const mappedRows = rows.map((row) => {
        const user = userById.get(row.userId);
        return {
          ...row,
          userName: user?.name?.trim() || `用户-${row.userId}`,
          userDepartment: user?.department ?? null,
        };
      });

      const keyword = input.search?.trim().toLowerCase();
      if (!keyword) {
        return mappedRows;
      }

      return mappedRows.filter((row) => {
        return (
          row.userName.toLowerCase().includes(keyword) ||
          (row.userDepartment?.toLowerCase().includes(keyword) ?? false) ||
          (row.reason?.toLowerCase().includes(keyword) ?? false) ||
          row.type.toLowerCase().includes(keyword)
        );
      });
    }),

  approve: adminQuery
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        approvedBy: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: attendances.id,
            userId: attendances.userId,
          })
          .from(attendances)
          .where(and(eq(attendances.id, input.id), isNull(attendances.deletedAt)))
          .limit(1);

        if (!existing[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "请假记录不存在" });
        }

        await tx
          .update(attendances)
          .set({
            status: input.status,
            approvedBy: input.approvedBy,
            approvedAt: new Date(),
          })
          .where(eq(attendances.id, input.id));

        const matchedUser = existing[0] ? await getUserInfo(db, existing[0].userId) : null;

        await createActivity(tx, {
          type: "leave_status_changed",
          description: `将员工「${matchedUser?.name ?? existing[0]?.userId ?? input.id}」的请假状态改为${leaveStatusLabelMap[input.status]}`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: attendances.id,
            userId: attendances.userId,
          })
          .from(attendances)
          .where(and(eq(attendances.id, input.id), isNull(attendances.deletedAt)))
          .limit(1);

        if (!existing[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "请假记录不存在" });
        }

        await tx
          .update(attendances)
          .set({ deletedAt: new Date() })
          .where(eq(attendances.id, input.id));

        const matchedUser = existing[0] ? await getUserInfo(db, existing[0].userId) : null;

        await createActivity(tx, {
          type: "leave_deleted",
          description: `删除了员工「${matchedUser?.name ?? existing[0]?.userId ?? input.id}」的请假记录`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { success: true };
    }),

  stats: adminQuery
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(attendances)
        .where(
          and(
            isNull(attendances.deletedAt),
            gte(attendances.endDate, input.startDate),
            lte(attendances.startDate, input.endDate),
          ),
        );

      return {
        total: rows.length,
        sick: rows.filter((row) => row.type === "sick").length,
        annual: rows.filter((row) => row.type === "annual").length,
        personal: rows.filter((row) => row.type === "personal").length,
        marriage: rows.filter((row) => row.type === "marriage").length,
        maternity: rows.filter((row) => row.type === "maternity").length,
        other: rows.filter((row) => row.type === "other").length,
      };
    }),
});
