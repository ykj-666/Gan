import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { type SQL, and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as path from "path";
import { businessTrips, tasks, users } from "@db/schema";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { createActivity } from "../lib/activity";
import {
  calculateBusinessTripMetrics,
  daysInclusive,
  getCycleRangeFromMonth,
} from "@contracts/business-trip";

const businessTripInputSchema = z.object({
  userId: z.number().int().positive(),
  employeeName: z.string().min(1).optional(),
  department: z.string().optional(),
  projectCode: z.string().min(1),
  cycleStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  cycleEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  dispatchStart: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  ]),
  dispatchEnd: z.union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD"),
  ]),
  location: z.string().min(1),
  workDays: z.number().int().nonnegative().max(366),
  officeDays: z.number().int().nonnegative().max(366),
  tripDays: z.number().int().nonnegative().max(366),
  tempDays: z.number().int().nonnegative().max(366),
  absenceReason: z.string().max(2000).optional(),
  subsidyDays: z.number().int().nonnegative().max(366),
  remark: z.string().max(5000).optional(),
});

type BusinessTripInput = z.infer<typeof businessTripInputSchema>;
const exportTripRowSchema = z.object({
  id: z.number().int(),
  userId: z.number().int().nullable(),
  employeeName: z.string(),
  department: z.string(),
  projectName: z.string().nullable().optional(),
  projectCode: z.string(),
  cycleStart: z.string(),
  cycleEnd: z.string(),
  dispatchStart: z.string(),
  dispatchEnd: z.string(),
  location: z.string(),
  workDays: z.number().int(),
  actualDays: z.number().int(),
  officeDays: z.number().int(),
  tripDays: z.number().int(),
  tempDays: z.number().int(),
  absenceDays: z.number().int(),
  absenceReason: z.string().nullable(),
  subsidyDays: z.number().int(),
  remark: z.string().nullable(),
});

type TripListRow = {
  id: number;
  userId: number | null;
  employeeName: string;
  department: string;
  projectName: string | null;
  projectCode: string;
  cycleStart: string;
  cycleEnd: string;
  dispatchStart: string;
  dispatchEnd: string;
  location: string;
  workDays: number;
  actualDays: number;
  officeDays: number;
  tripDays: number;
  tempDays: number;
  absenceDays: number;
  absenceReason: string | null;
  subsidyDays: number;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const tripSelect = {
  id: businessTrips.id,
  userId: businessTrips.userId,
  employeeName: sql<string>`coalesce(${users.name}, ${businessTrips.employeeName})`.as(
    "employeeName",
  ),
  department: businessTrips.department,
  projectCode: businessTrips.projectCode,
  cycleStart: businessTrips.cycleStart,
  cycleEnd: businessTrips.cycleEnd,
  dispatchStart: businessTrips.dispatchStart,
  dispatchEnd: businessTrips.dispatchEnd,
  location: businessTrips.location,
  workDays: businessTrips.workDays,
  actualDays: businessTrips.actualDays,
  officeDays: businessTrips.officeDays,
  tripDays: businessTrips.tripDays,
  tempDays: businessTrips.tempDays,
  absenceDays: businessTrips.absenceDays,
  absenceReason: businessTrips.absenceReason,
  subsidyDays: businessTrips.subsidyDays,
  remark: businessTrips.remark,
  createdAt: businessTrips.createdAt,
  updatedAt: businessTrips.updatedAt,
} as const;

async function attachProjectNames(rows: TripListRow[]) {
  const projectCodes = Array.from(
    new Set(rows.map((row) => row.projectCode.trim()).filter(Boolean)),
  );

  if (projectCodes.length === 0) {
    return rows.map((row) => ({ ...row, projectName: null }));
  }

  const db = getDb();
  const matchedTasks = await db
    .select({ projectCode: tasks.projectCode, projectName: tasks.projectName })
    .from(tasks)
    .where(and(inArray(tasks.projectCode, projectCodes), isNull(tasks.deletedAt)))
    .orderBy(desc(tasks.createdAt));

  const projectNameByCode = new Map<string, string>();
  matchedTasks.forEach((task) => {
    const code = task.projectCode?.trim();
    if (!code || projectNameByCode.has(code)) return;
    projectNameByCode.set(code, task.projectName.trim());
  });

  return rows.map((row) => ({
    ...row,
    projectName: projectNameByCode.get(row.projectCode.trim()) ?? null,
  }));
}

async function normalizeBusinessTripInput(input: BusinessTripInput) {
  if (input.dispatchStart && input.dispatchEnd && input.dispatchStart > input.dispatchEnd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "派遣结束日不能早于起始日",
    });
  }

  if (input.cycleStart > input.cycleEnd) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "考勤周期结束日不能早于开始日",
    });
  }

  const db = getDb();
  const matchedUser = await db
    .select({ id: users.id, name: users.name, department: users.department })
    .from(users)
    .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
    .limit(1);

  if (!matchedUser[0]) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "员工不存在，请重新选择",
    });
  }

  const resolvedEmployeeName =
    matchedUser[0].name?.trim() || input.employeeName?.trim() || "";
  if (!resolvedEmployeeName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "员工姓名不能为空",
    });
  }

  const resolvedDepartment =
    input.department?.trim() || matchedUser[0].department?.trim() || "";
  if (!resolvedDepartment) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "部门不能为空",
    });
  }

  const metrics = calculateBusinessTripMetrics({
    cycleStart: input.cycleStart,
    cycleEnd: input.cycleEnd,
    dispatchStart: input.dispatchStart,
    dispatchEnd: input.dispatchEnd,
    workDays: input.workDays,
    officeDays: input.officeDays,
    tripDays: input.tripDays,
    tempDays: input.tempDays,
    subsidyDays: input.subsidyDays,
  });

  if (metrics.absenceDays > 0 && !input.absenceReason?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "缺勤天数大于 0 时必须填写缺勤原因",
    });
  }

  const cycleDays = daysInclusive(input.cycleStart, input.cycleEnd);
  if (metrics.subsidyDays > cycleDays && !input.remark?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "出差补贴天数超过周期天数时必须填写备注",
    });
  }

  return {
    ...input,
    employeeName: resolvedEmployeeName,
    department: resolvedDepartment,
    projectCode: input.projectCode.trim(),
    location: input.location.trim(),
    absenceReason: input.absenceReason?.trim() || null,
    remark: input.remark?.trim() || null,
    actualDays: metrics.actualDays,
    absenceDays: metrics.absenceDays,
    officeDays: metrics.officeDays,
    tripDays: metrics.tripDays,
    tempDays: metrics.tempDays,
    subsidyDays: metrics.subsidyDays,
    workDays: metrics.workDays,
  };
}

function buildConditions(input?: {
  cycleMonth?: string;
  department?: string;
  search?: string;
  userId?: number;
}) {
  const conditions: SQL[] = [isNull(businessTrips.deletedAt)];

  if (input?.cycleMonth) {
    const cycle = getCycleRangeFromMonth(input.cycleMonth);
    conditions.push(eq(businessTrips.cycleStart, cycle.cycleStart));
    conditions.push(eq(businessTrips.cycleEnd, cycle.cycleEnd));
  }

  if (input?.department) {
    conditions.push(eq(businessTrips.department, input.department));
  }

  if (input?.userId) {
    conditions.push(eq(businessTrips.userId, input.userId));
  }

  if (input?.search?.trim()) {
    const keyword = `%${input.search.trim()}%`;
    conditions.push(
      sql`(
        coalesce(${users.name}, ${businessTrips.employeeName}) like ${keyword}
        or ${businessTrips.projectCode} like ${keyword}
        or ${businessTrips.location} like ${keyword}
      )`,
    );
  }

  return conditions;
}

async function selectTripRows(input?: {
  cycleMonth?: string;
  department?: string;
  search?: string;
  userId?: number;
}) {
  const db = getDb();
  const conditions = buildConditions(input);
  const query = db
    .select(tripSelect)
    .from(businessTrips)
    .leftJoin(users, eq(users.id, businessTrips.userId));

  if (conditions.length > 1) {
    return attachProjectNames((await query
      .where(and(...conditions))
      .orderBy(
        desc(businessTrips.createdAt),
        asc(businessTrips.department),
        asc(users.name),
        asc(businessTrips.employeeName),
      )) as TripListRow[]);
  }

  return attachProjectNames((await query.orderBy(
    desc(businessTrips.createdAt),
    asc(businessTrips.department),
    asc(users.name),
    asc(businessTrips.employeeName),
  )) as TripListRow[]);
}

function formatSheetName(cycleStart: string, cycleEnd: string) {
  const [, startMonth, startDay] = cycleStart.split("-");
  const [, endMonth, endDay] = cycleEnd.split("-");
  return `${startMonth}${startDay}-${endMonth}${endDay}`;
}

function formatCycleText(cycleStart: string, cycleEnd: string) {
  const [startYear, startMonth, startDay] = cycleStart.split("-");
  const [endYear, endMonth, endDay] = cycleEnd.split("-");
  return `考勤周期：${startYear}年${startMonth}月${startDay}日-${endYear}年${endMonth}月${endDay}日`;
}

function getExportDepartmentLabel(department?: string) {
  return department?.trim() || "全部部门";
}

void formatCycleText;

function getExportMonthLabel(cycleMonth: string) {
  const [, month] = cycleMonth.split("-");
  return `${month}月`;
}

function formatCycleValue(cycleStart: string, cycleEnd: string) {
  const [startYear, startMonth, startDay] = cycleStart.split("-");
  const [endYear, endMonth, endDay] = cycleEnd.split("-");
  return `${startYear}年${Number(startMonth)}月${Number(startDay)}日-${endYear}年${Number(endMonth)}月${Number(endDay)}日`;
}

function formatSlashDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

function buildProjectSummary(rows: TripListRow[]) {
  const names = [...new Set(rows.map((row) => row.projectName?.trim()).filter(Boolean))];
  const codes = [...new Set(rows.map((row) => row.projectCode.trim()).filter(Boolean))];

  if (codes.length === 0) {
    return {
      title: "XX项目",
      code: "",
    };
  }

  if (codes.length === 1) {
    return {
      title: names[0] ?? "XX项目",
      code: codes[0],
    };
  }

  return {
    title: "多项目汇总",
    code: codes.join("、"),
  };
}

async function buildWorkbook(
  rows: TripListRow[],
  cycleMonth: string,
  _department?: string,
) {
  const excelModule = await import("exceljs");
  const ExcelJS = excelModule.default ?? excelModule;
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), "api", "templates", "business-trip-template.xlsx");
  await workbook.xlsx.readFile(templatePath);

  const cycle = getCycleRangeFromMonth(cycleMonth);
  const projectSummary = buildProjectSummary(rows);
  const worksheet = workbook.worksheets[0];
  worksheet.name = formatSheetName(cycle.cycleStart, cycle.cycleEnd);

  const dataRowNumber = 5;
  const templateBlankRowCount = 2;
  const exportRowCount = Math.max(rows.length, 1);

  worksheet.getCell("A1").value = projectSummary.title;
  worksheet.getCell("B2").value = projectSummary.code;
  worksheet.getCell("B3").value = formatCycleValue(cycle.cycleStart, cycle.cycleEnd);

  if (exportRowCount < templateBlankRowCount) {
    worksheet.spliceRows(
      dataRowNumber + exportRowCount,
      templateBlankRowCount - exportRowCount,
    );
  } else if (exportRowCount > templateBlankRowCount) {
    worksheet.duplicateRow(
      dataRowNumber + templateBlankRowCount - 1,
      exportRowCount - templateBlankRowCount,
      true,
    );
  }

  const exportRows = rows.length > 0 ? rows : [null];
  exportRows.forEach((row, index) => {
    const rowNumber = dataRowNumber + index;
    const excelRow = worksheet.getRow(rowNumber);
    const values = row
      ? [
          row.employeeName,
          row.department,
          row.workDays || "",
          row.actualDays || "",
          row.officeDays || "",
          row.tripDays || "",
          row.tempDays || "",
          row.absenceDays || "",
          row.absenceReason ?? "",
          row.dispatchStart ? formatSlashDate(row.dispatchStart) : "",
          row.dispatchEnd ? formatSlashDate(row.dispatchEnd) : "",
          row.location,
          row.subsidyDays || "",
          row.remark ?? "",
        ]
      : new Array(14).fill("");

    for (let columnNumber = 1; columnNumber <= 14; columnNumber += 1) {
      excelRow.getCell(columnNumber).value = values[columnNumber - 1];
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

export const businessTripRouter = createRouter({
  list: adminQuery
    .input(
      z
        .object({
          cycleMonth: z.string().optional(),
          department: z.string().optional(),
          search: z.string().optional(),
          userId: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => selectTripRows(input)),

  departments: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ department: businessTrips.department })
      .from(businessTrips)
      .where(isNull(businessTrips.deletedAt))
      .groupBy(businessTrips.department)
      .orderBy(asc(businessTrips.department));
    return rows.map((row) => row.department).filter(Boolean);
  }),

  create: adminQuery
    .input(businessTripInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const normalized = await normalizeBusinessTripInput(input);

      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(businessTrips).values({
          userId: normalized.userId,
          employeeName: normalized.employeeName,
          department: normalized.department,
          projectCode: normalized.projectCode,
          cycleStart: normalized.cycleStart,
          cycleEnd: normalized.cycleEnd,
          dispatchStart: normalized.dispatchStart,
          dispatchEnd: normalized.dispatchEnd,
          location: normalized.location,
          workDays: normalized.workDays,
          actualDays: normalized.actualDays,
          officeDays: normalized.officeDays,
          tripDays: normalized.tripDays,
          tempDays: normalized.tempDays,
          absenceDays: normalized.absenceDays,
          absenceReason: normalized.absenceReason,
          subsidyDays: normalized.subsidyDays,
          remark: normalized.remark,
        }).$returningId();

        await createActivity(tx, {
          type: "trip_created",
          description: `新增了员工「${normalized.employeeName}」的出差考勤记录`,
          userId: ctx.user.id,
          req: ctx.req,
        });

        if (!inserted?.id) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "出差记录创建失败" });
        }

        return inserted.id;
      });

      return { id: result, ...normalized };
    }),

  batchCreate: adminQuery
    .input(z.array(businessTripInputSchema).min(1))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const inserted = await db.transaction(async (tx) => {
        const records = [];
        for (const item of input) {
          const normalized = await normalizeBusinessTripInput(item);
          const [inserted] = await tx.insert(businessTrips).values({
            userId: normalized.userId,
            employeeName: normalized.employeeName,
            department: normalized.department,
            projectCode: normalized.projectCode,
            cycleStart: normalized.cycleStart,
            cycleEnd: normalized.cycleEnd,
            dispatchStart: normalized.dispatchStart,
            dispatchEnd: normalized.dispatchEnd,
            location: normalized.location,
            workDays: normalized.workDays,
            actualDays: normalized.actualDays,
            officeDays: normalized.officeDays,
            tripDays: normalized.tripDays,
            tempDays: normalized.tempDays,
            absenceDays: normalized.absenceDays,
            absenceReason: normalized.absenceReason,
            subsidyDays: normalized.subsidyDays,
            remark: normalized.remark,
          }).$returningId();

          if (!inserted?.id) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "出差记录批量创建失败" });
          }

          records.push({ id: inserted.id, ...normalized });
        }

        await createActivity(tx, {
          type: "trip_imported",
          description: `批量导入了 ${records.length} 条出差考勤记录`,
          userId: ctx.user.id,
          req: ctx.req,
        });

        return records;
      });

      return { count: inserted.length, records: inserted };
    }),

  update: adminQuery
    .input(businessTripInputSchema.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { id, ...rest } = input;
      const normalized = await normalizeBusinessTripInput(rest);

      await db.transaction(async (tx) => {
        await tx
          .update(businessTrips)
          .set({
            userId: normalized.userId,
            employeeName: normalized.employeeName,
            department: normalized.department,
            projectCode: normalized.projectCode,
            cycleStart: normalized.cycleStart,
            cycleEnd: normalized.cycleEnd,
            dispatchStart: normalized.dispatchStart,
            dispatchEnd: normalized.dispatchEnd,
            location: normalized.location,
            workDays: normalized.workDays,
            actualDays: normalized.actualDays,
            officeDays: normalized.officeDays,
            tripDays: normalized.tripDays,
            tempDays: normalized.tempDays,
            absenceDays: normalized.absenceDays,
            absenceReason: normalized.absenceReason,
            subsidyDays: normalized.subsidyDays,
            remark: normalized.remark,
          })
          .where(eq(businessTrips.id, id));

        await createActivity(tx, {
          type: "trip_updated",
          description: `更新了员工「${normalized.employeeName}」的出差考勤记录`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { id, ...normalized };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            employeeName: businessTrips.employeeName,
            projectCode: businessTrips.projectCode,
          })
          .from(businessTrips)
          .where(and(eq(businessTrips.id, input.id), isNull(businessTrips.deletedAt)))
          .limit(1);

        if (!existing[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "出差记录不存在" });
        }

        await tx
          .update(businessTrips)
          .set({ deletedAt: new Date() })
          .where(eq(businessTrips.id, input.id));

        await createActivity(tx, {
          type: "trip_deleted",
          description: `删除了员工「${existing[0]?.employeeName ?? input.id}」的出差记录（${existing[0]?.projectCode ?? "-" }）`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { success: true };
    }),

  exportXlsx: adminQuery
    .input(
      z.object({
        cycleMonth: z.string(),
        department: z.string().optional(),
        records: z.array(exportTripRowSchema).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const rows =
        input.records && input.records.length > 0
          ? await attachProjectNames(input.records as TripListRow[])
          : await selectTripRows({
              cycleMonth: input.cycleMonth,
              department: input.department,
            });

      const fileBase64 = await buildWorkbook(rows, input.cycleMonth, input.department);
      const departmentLabel = getExportDepartmentLabel(input.department);
      const monthLabel = getExportMonthLabel(input.cycleMonth);

      return {
        fileName: `现场考勤表-${departmentLabel} -${monthLabel}.xlsx`,
        fileBase64,
        count: rows.length,
      };
    }),
});
