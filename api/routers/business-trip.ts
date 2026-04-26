import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { type SQL, and, asc, desc, eq, sql } from "drizzle-orm";
import { businessTrips, users } from "@db/schema";
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
  cycleStart: z.string().min(1),
  cycleEnd: z.string().min(1),
  dispatchStart: z.string().min(1),
  dispatchEnd: z.string().min(1),
  location: z.string().min(1),
  workDays: z.number().int().nonnegative(),
  officeDays: z.number().int().nonnegative(),
  tripDays: z.number().int().nonnegative(),
  tempDays: z.number().int().nonnegative(),
  absenceReason: z.string().optional(),
  subsidyDays: z.number().int().nonnegative(),
  remark: z.string().optional(),
});

type BusinessTripInput = z.infer<typeof businessTripInputSchema>;

type TripListRow = {
  id: number;
  userId: number | null;
  employeeName: string;
  department: string;
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

async function normalizeBusinessTripInput(input: BusinessTripInput) {
  if (input.dispatchStart > input.dispatchEnd) {
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
    .where(eq(users.id, input.userId))
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
  const conditions: SQL[] = [];

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

  if (conditions.length > 0) {
    return (await query
      .where(and(...conditions))
      .orderBy(
        desc(businessTrips.createdAt),
        asc(businessTrips.department),
        asc(users.name),
        asc(businessTrips.employeeName),
      )) as TripListRow[];
  }

  return (await query.orderBy(
    desc(businessTrips.createdAt),
    asc(businessTrips.department),
    asc(users.name),
    asc(businessTrips.employeeName),
  )) as TripListRow[];
}

async function buildWorkbook(
  rows: TripListRow[],
  cycleMonth: string,
  department?: string,
) {
  const excelModule = await import("exceljs");
  const ExcelJS = excelModule.default ?? excelModule;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("出差考勤", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  worksheet.columns = [
    { key: "projectCode", width: 20 },
    { key: "cycleLabel", width: 28 },
    { key: "workDays", width: 16 },
    { key: "actualDays", width: 18 },
    { key: "officeDays", width: 12 },
    { key: "tripDays", width: 16 },
    { key: "tempDays", width: 16 },
    { key: "absenceDays", width: 12 },
    { key: "absenceReason", width: 18 },
    { key: "dispatchStart", width: 18 },
    { key: "dispatchEnd", width: 18 },
    { key: "location", width: 18 },
    { key: "subsidyDays", width: 18 },
    { key: "remark", width: 28 },
  ];

  const cycle = getCycleRangeFromMonth(cycleMonth);
  worksheet.mergeCells("A1:G1");
  worksheet.mergeCells("H1:N1");
  worksheet.getCell("A1").value = `项目编号：${
    rows.length === 1 ? rows[0].projectCode : "批量导出"
  }`;
  worksheet.getCell("H1").value = `考勤周期：${cycle.label}${
    department ? `  部门：${department}` : ""
  }`;

  const topFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFEFF3F8" },
  };
  const highlightFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFFF4CC" },
  };
  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFD9D9D9" },
  };
  const border = {
    top: { style: "thin", color: { argb: "FFBDBDBD" } },
    left: { style: "thin", color: { argb: "FFBDBDBD" } },
    bottom: { style: "thin", color: { argb: "FFBDBDBD" } },
    right: { style: "thin", color: { argb: "FFBDBDBD" } },
  } as const;

  ["A1", "H1"].forEach((cellRef) => {
    const cell = worksheet.getCell(cellRef);
    cell.font = { bold: true, size: 12 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.fill = topFill;
    cell.border = border;
  });

  const headers = [
    "项目编号",
    "考勤周期",
    "本月应出勤天数",
    "本月实际出勤天数合计",
    "办公区",
    "长期出差（现场）",
    "临时外派其他项目",
    "缺勤天数",
    "缺勤原因",
    "派遣函长差起始日【必填】以函为准",
    "长差派遣结束日【必填】以函为准",
    "长差（现场）所在地",
    "计算出差补贴天数",
    "备注",
  ];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell, columnNumber) => {
    cell.font = { bold: true };
    cell.fill = [6, 10, 11, 12, 13].includes(columnNumber)
      ? highlightFill
      : headerFill;
    cell.border = border;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  worksheet.autoFilter = "A2:N2";

  rows.forEach((row) => {
    const excelRow = worksheet.addRow([
      row.projectCode,
      `${row.cycleStart}-${row.cycleEnd}`,
      row.workDays,
      row.actualDays,
      row.officeDays,
      row.tripDays,
      row.tempDays,
      row.absenceDays,
      row.absenceReason ?? "",
      row.dispatchStart,
      row.dispatchEnd,
      row.location,
      row.subsidyDays,
      row.remark ?? "",
    ]);

    excelRow.eachCell((cell, columnNumber) => {
      cell.border = border;
      cell.alignment = {
        vertical: "middle",
        horizontal: columnNumber >= 3 && columnNumber <= 13 ? "center" : "left",
        wrapText: true,
      };
      if ([6, 10, 11, 12, 13].includes(columnNumber)) {
        cell.fill = highlightFill;
      }
    });
  });

  const notesStart = worksheet.rowCount + 2;
  worksheet.mergeCells(`A${notesStart}:N${notesStart}`);
  worksheet.mergeCells(`A${notesStart + 1}:N${notesStart + 1}`);
  worksheet.mergeCells(`A${notesStart + 2}:N${notesStart + 2}`);
  worksheet.getCell(`A${notesStart}`).value =
    "填报规则说明：M > 周期天数时必须填写备注；H > 0 时必须填写缺勤原因；J/K 为必填项。";
  worksheet.getCell(`A${notesStart + 1}`).value =
    "长期出差相关列：F / J / K / L / M 已重点标记，请根据派遣函和现场实际情况核对。";
  worksheet.getCell(`A${notesStart + 2}`).value =
    "考勤周期固定为上月25日至当月24日，每月26日17:00前上报人力资源部。";

  [notesStart, notesStart + 1, notesStart + 2].forEach((rowNumber) => {
    const cell = worksheet.getCell(`A${rowNumber}`);
    cell.font = {
      size: 10,
      italic: true,
      color: { argb: "FF666666" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
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
      .groupBy(businessTrips.department)
      .orderBy(asc(businessTrips.department));
    return rows.map((row) => row.department).filter(Boolean);
  }),

  create: adminQuery
    .input(businessTripInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const normalized = await normalizeBusinessTripInput(input);
      const now = Math.floor(Date.now() / 1000);

      const result = await db.run(sql`
        INSERT INTO business_trip (
          user_id, employee_name, department, project_code, cycle_start, cycle_end,
          dispatch_start, dispatch_end, location, work_days, actual_days,
          office_days, trip_days, temp_days, absence_days, absence_reason,
          subsidy_days, remark, created_at, updated_at
        ) VALUES (
          ${normalized.userId}, ${normalized.employeeName}, ${normalized.department}, ${normalized.projectCode},
          ${normalized.cycleStart}, ${normalized.cycleEnd}, ${normalized.dispatchStart},
          ${normalized.dispatchEnd}, ${normalized.location}, ${normalized.workDays},
          ${normalized.actualDays}, ${normalized.officeDays}, ${normalized.tripDays},
          ${normalized.tempDays}, ${normalized.absenceDays}, ${normalized.absenceReason},
          ${normalized.subsidyDays}, ${normalized.remark}, ${now}, ${now}
        )
      `);

      await createActivity(db, {
        type: "trip_created",
        description: `新增了员工「${normalized.employeeName}」的出差考勤记录`,
        userId: ctx.user.id,
      });

      return { id: Number(result.lastInsertRowid), ...normalized };
    }),

  batchCreate: adminQuery
    .input(z.array(businessTripInputSchema).min(1))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const inserted = [];

      for (const item of input) {
        const normalized = await normalizeBusinessTripInput(item);
        const now = Math.floor(Date.now() / 1000);
        const result = await db.run(sql`
          INSERT INTO business_trip (
            user_id, employee_name, department, project_code, cycle_start, cycle_end,
            dispatch_start, dispatch_end, location, work_days, actual_days,
            office_days, trip_days, temp_days, absence_days, absence_reason,
            subsidy_days, remark, created_at, updated_at
          ) VALUES (
            ${normalized.userId}, ${normalized.employeeName}, ${normalized.department}, ${normalized.projectCode},
            ${normalized.cycleStart}, ${normalized.cycleEnd}, ${normalized.dispatchStart},
            ${normalized.dispatchEnd}, ${normalized.location}, ${normalized.workDays},
            ${normalized.actualDays}, ${normalized.officeDays}, ${normalized.tripDays},
            ${normalized.tempDays}, ${normalized.absenceDays}, ${normalized.absenceReason},
            ${normalized.subsidyDays}, ${normalized.remark}, ${now}, ${now}
          )
        `);

        inserted.push({ id: Number(result.lastInsertRowid), ...normalized });
      }

      await createActivity(db, {
        type: "trip_imported",
        description: `批量导入了 ${inserted.length} 条出差考勤记录`,
        userId: ctx.user.id,
      });

      return { count: inserted.length, records: inserted };
    }),

  update: adminQuery
    .input(businessTripInputSchema.extend({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const { id, ...rest } = input;
      const normalized = await normalizeBusinessTripInput(rest);
      const now = Math.floor(Date.now() / 1000);

      await db.run(sql`
        UPDATE business_trip
        SET user_id = ${normalized.userId},
            employee_name = ${normalized.employeeName},
            department = ${normalized.department},
            project_code = ${normalized.projectCode},
            cycle_start = ${normalized.cycleStart},
            cycle_end = ${normalized.cycleEnd},
            dispatch_start = ${normalized.dispatchStart},
            dispatch_end = ${normalized.dispatchEnd},
            location = ${normalized.location},
            work_days = ${normalized.workDays},
            actual_days = ${normalized.actualDays},
            office_days = ${normalized.officeDays},
            trip_days = ${normalized.tripDays},
            temp_days = ${normalized.tempDays},
            absence_days = ${normalized.absenceDays},
            absence_reason = ${normalized.absenceReason},
            subsidy_days = ${normalized.subsidyDays},
            remark = ${normalized.remark},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      await createActivity(db, {
        type: "trip_updated",
        description: `更新了员工「${normalized.employeeName}」的出差考勤记录`,
        userId: ctx.user.id,
      });

      return { id, ...normalized };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db
        .select({
          employeeName: businessTrips.employeeName,
          projectCode: businessTrips.projectCode,
        })
        .from(businessTrips)
        .where(eq(businessTrips.id, input.id))
        .limit(1);
      await db.delete(businessTrips).where(eq(businessTrips.id, input.id));

      await createActivity(db, {
        type: "trip_deleted",
        description: `删除了员工「${existing[0]?.employeeName ?? input.id}」的出差记录（${existing[0]?.projectCode ?? "-" }）`,
        userId: ctx.user.id,
      });

      return { success: true };
    }),

  exportXlsx: adminQuery
    .input(
      z.object({
        cycleMonth: z.string(),
        department: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await selectTripRows({
        cycleMonth: input.cycleMonth,
        department: input.department,
      });

      const fileBase64 = await buildWorkbook(rows, input.cycleMonth, input.department);
      const cycle = getCycleRangeFromMonth(input.cycleMonth);
      const suffix = input.department ? `-${input.department}` : "";

      return {
        fileName: `出差考勤统计-${cycle.label}${suffix}.xlsx`,
        fileBase64,
        count: rows.length,
      };
    }),
});
