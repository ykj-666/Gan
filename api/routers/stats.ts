import { z } from "zod";
import { isNull } from "drizzle-orm";
import { attendances, businessTrips, tasks, users } from "@db/schema";
import { getCycleRangeFromMonth } from "@contracts/business-trip";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function cycleDays(cycleStart: string, cycleEnd: string) {
  return diffDays(cycleStart, cycleEnd) + 1;
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const endDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
  };
}

function buildTripAlert(trip: typeof businessTrips.$inferSelect) {
  const alerts: Array<{
    id: string;
    tripId: number;
    employeeName: string;
    department: string;
    projectCode: string;
    location: string;
    cycleStart: string;
    cycleEnd: string;
    type: "absence_reason_missing" | "remark_required";
    message: string;
    createdAt: Date;
  }> = [];

  if (trip.absenceDays > 0 && !trip.absenceReason?.trim()) {
    alerts.push({
      id: `absence-${trip.id}`,
      tripId: trip.id,
      employeeName: trip.employeeName,
      department: trip.department,
      projectCode: trip.projectCode,
      location: trip.location,
      cycleStart: trip.cycleStart,
      cycleEnd: trip.cycleEnd,
      type: "absence_reason_missing",
      message: `缺勤 ${trip.absenceDays} 天，但未填写缺勤原因`,
      createdAt: trip.createdAt,
    });
  }

  if (trip.subsidyDays > cycleDays(trip.cycleStart, trip.cycleEnd) && !trip.remark?.trim()) {
    alerts.push({
      id: `remark-${trip.id}`,
      tripId: trip.id,
      employeeName: trip.employeeName,
      department: trip.department,
      projectCode: trip.projectCode,
      location: trip.location,
      cycleStart: trip.cycleStart,
      cycleEnd: trip.cycleEnd,
      type: "remark_required",
      message: "补贴天数超过考勤周期，但未填写备注",
      createdAt: trip.createdAt,
    });
  }

  return alerts;
}

export const statsRouter = createRouter({
  dashboard: adminQuery.query(async () => {
    const db = getDb();

    const [allTasks, allUsers, allAttendances, allTrips] = await Promise.all([
      db.select().from(tasks).where(isNull(tasks.deletedAt)),
      db.select().from(users).where(isNull(users.deletedAt)),
      db.select().from(attendances).where(isNull(attendances.deletedAt)),
      db.select().from(businessTrips).where(isNull(businessTrips.deletedAt)),
    ]);

    const userMap = new Map(allUsers.map((user) => [user.id, user]));
    const today = toDateOnly(new Date());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const totalCount = allTasks.length;
    const todoCount = allTasks.filter((task) => task.status === "todo").length;
    const inProgressCount = allTasks.filter((task) => task.status === "in_progress").length;
    const reviewCount = allTasks.filter((task) => task.status === "review").length;
    const doneCount = allTasks.filter((task) => task.status === "done").length;
    const urgentCount = allTasks.filter((task) => task.priority === "urgent").length;
    const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    const thisWeekTasks = allTasks.filter(
      (task) => task.createdAt && new Date(task.createdAt) >= weekAgo,
    ).length;

    const taskStatsByUserId = new Map<
      number,
      {
        total: number;
        done: number;
        inProgress: number;
        todo: number;
        review: number;
        overdue: number;
      }
    >();

    for (const task of allTasks) {
      if (!task.assigneeId) continue;

      const current = taskStatsByUserId.get(task.assigneeId) ?? {
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
        review: 0,
        overdue: 0,
      };

      current.total += 1;
      if (task.status === "done") current.done += 1;
      if (task.status === "in_progress") current.inProgress += 1;
      if (task.status === "todo") current.todo += 1;
      if (task.status === "review") current.review += 1;
      if (task.status !== "done" && task.plannedEndDate && task.plannedEndDate < today) {
        current.overdue += 1;
      }

      taskStatsByUserId.set(task.assigneeId, current);
    }

    const activeLeaveCountByUserId = new Map<number, number>();
    for (const leave of allAttendances) {
      if (leave.status === "rejected") continue;
      if (leave.startDate <= today && leave.endDate >= today) {
        activeLeaveCountByUserId.set(
          leave.userId,
          (activeLeaveCountByUserId.get(leave.userId) ?? 0) + 1,
        );
      }
    }

    const tripAlertRows = allTrips.flatMap((trip) => buildTripAlert(trip));
    const tripAlertCountByUserId = new Map<number, number>();
    const activeTripCountByUserId = new Map<number, number>();

    for (const trip of allTrips) {
      if (trip.userId && trip.dispatchStart <= today && trip.dispatchEnd >= today) {
        activeTripCountByUserId.set(
          trip.userId,
          (activeTripCountByUserId.get(trip.userId) ?? 0) + 1,
        );
      }

      if (trip.userId) {
        const alertCount = buildTripAlert(trip).length;
        if (alertCount > 0) {
          tripAlertCountByUserId.set(
            trip.userId,
            (tripAlertCountByUserId.get(trip.userId) ?? 0) + alertCount,
          );
        }
      }
    }

    const memberStats = allUsers
      .map((user) => {
        const userStats = taskStatsByUserId.get(user.id) ?? {
          total: 0,
          done: 0,
          inProgress: 0,
          todo: 0,
          review: 0,
          overdue: 0,
        };
        const efficiency = userStats.total > 0 ? Math.round((userStats.done / userStats.total) * 100) : 0;
        const activeLeaveCount = activeLeaveCountByUserId.get(user.id) ?? 0;
        const tripAlertCount = tripAlertCountByUserId.get(user.id) ?? 0;
        const activeTripCount = activeTripCountByUserId.get(user.id) ?? 0;
        const currentLoad =
          userStats.inProgress * 2 +
          userStats.todo +
          userStats.review +
          userStats.overdue * 2 +
          activeLeaveCount +
          tripAlertCount;

        return {
          id: user.id,
          name: user.name ?? "未命名",
          department: user.department,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          total: userStats.total,
          done: userStats.done,
          inProgress: userStats.inProgress,
          todo: userStats.todo,
          review: userStats.review,
          efficiency,
          overdue: userStats.overdue,
          activeLeaveCount,
          tripAlertCount,
          activeTripCount,
          currentLoad,
        };
      })
      .sort((left, right) => {
        if (right.currentLoad !== left.currentLoad) return right.currentLoad - left.currentLoad;
        if (right.total !== left.total) return right.total - left.total;
        return left.name.localeCompare(right.name, "zh-CN");
      });

    const overdueTasks = allTasks
      .filter(
        (task) => task.status !== "done" && Boolean(task.plannedEndDate) && task.plannedEndDate! < today,
      )
      .map((task) => ({
        id: task.id,
        projectName: task.projectName,
        projectCode: task.projectCode,
        assigneeId: task.assigneeId,
        assigneeName: task.assigneeId ? userMap.get(task.assigneeId)?.name ?? "未分配" : "未分配",
        plannedEndDate: task.plannedEndDate,
        priority: task.priority,
        status: task.status,
        overdueDays: diffDays(task.plannedEndDate!, today),
      }))
      .sort((left, right) => right.overdueDays - left.overdueDays)
      .slice(0, 8);

    const activeLeaves = allAttendances
      .filter(
        (leave) => leave.status !== "rejected" && leave.startDate <= today && leave.endDate >= today,
      )
      .map((leave) => ({
        id: leave.id,
        userId: leave.userId,
        userName: userMap.get(leave.userId)?.name ?? "未命名",
        department: userMap.get(leave.userId)?.department ?? null,
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days ?? diffDays(leave.startDate, leave.endDate) + 1,
      }))
      .sort((left, right) => right.days - left.days)
      .slice(0, 8);

    const tripAlerts = tripAlertRows
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8);

    return {
      overview: {
        total: totalCount,
        todo: todoCount,
        inProgress: inProgressCount,
        review: reviewCount,
        done: doneCount,
        urgent: urgentCount,
        completionRate,
        thisWeekNew: thisWeekTasks,
      },
      memberStats,
      managerFocus: {
        overdueTasks,
        activeLeaves,
        tripAlerts,
      },
    };
  }),

  reportSummary: adminQuery
    .input(
      z.object({
        cycleMonth: z.string(),
        leaveMonth: z.string(),
        department: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const [allUsers, allTasks, allLeaves, allTrips] = await Promise.all([
        db.select().from(users).where(isNull(users.deletedAt)),
        db.select().from(tasks).where(isNull(tasks.deletedAt)),
        db.select().from(attendances).where(isNull(attendances.deletedAt)),
        db.select().from(businessTrips).where(isNull(businessTrips.deletedAt)),
      ]);

      const today = toDateOnly(new Date());
      const { startDate, endDate } = getMonthRange(input.leaveMonth);
      const cycle = getCycleRangeFromMonth(input.cycleMonth);

      const filteredUsers = allUsers.filter(
        (user) => !input.department || user.department === input.department,
      );
      const filteredUserIds = new Set(filteredUsers.map((user) => user.id));

      const filteredTasks = allTasks.filter((task) => {
        if (!input.department) return true;
        return Boolean(task.assigneeId && filteredUserIds.has(task.assigneeId));
      });

      const filteredLeaves = allLeaves.filter((leave) => {
        if (!filteredUserIds.has(leave.userId)) return false;
        return leave.endDate >= startDate && leave.startDate <= endDate;
      });

      const cycleFilteredTrips = allTrips.filter((trip) => {
        const matchDepartment = !input.department || trip.department === input.department;
        return (
          matchDepartment &&
          trip.cycleStart === cycle.cycleStart &&
          trip.cycleEnd === cycle.cycleEnd
        );
      });

      const filteredTripAlerts = cycleFilteredTrips.flatMap((trip) => buildTripAlert(trip));
      const activeLeavesNow = filteredLeaves.filter(
        (leave) => leave.status !== "rejected" && leave.startDate <= today && leave.endDate >= today,
      );

      const departmentSet = new Set(
        filteredUsers
          .map((user) => user.department?.trim())
          .filter((value): value is string => Boolean(value)),
      );

      const departmentRows = Array.from(departmentSet)
        .sort((left, right) => left.localeCompare(right, "zh-CN"))
        .map((department) => {
          const departmentUsers = filteredUsers.filter((user) => user.department === department);
          const departmentUserIds = new Set(departmentUsers.map((user) => user.id));
          const departmentTasks = filteredTasks.filter(
            (task) => Boolean(task.assigneeId && departmentUserIds.has(task.assigneeId)),
          );
          const departmentLeaves = filteredLeaves.filter((leave) => departmentUserIds.has(leave.userId));
          const departmentTrips = cycleFilteredTrips.filter((trip) => trip.department === department);
          const departmentTripAlerts = departmentTrips.flatMap((trip) => buildTripAlert(trip));

          return {
            department,
            headcount: departmentUsers.length,
            taskCount: departmentTasks.length,
            overdueTaskCount: departmentTasks.filter(
              (task) => task.status !== "done" && task.plannedEndDate && task.plannedEndDate < today,
            ).length,
            leaveCount: departmentLeaves.length,
            leaveDays: departmentLeaves.reduce((sum, leave) => sum + (leave.days ?? 0), 0),
            tripCount: departmentTrips.length,
            tripSubsidyDays: departmentTrips.reduce((sum, trip) => sum + trip.subsidyDays, 0),
            tripAlertCount: departmentTripAlerts.length,
          };
        });

      return {
        scope: {
          department: input.department ?? "全部部门",
          cycleMonth: input.cycleMonth,
          leaveMonth: input.leaveMonth,
          cycleLabel: cycle.label,
        },
        summary: {
          headcount: filteredUsers.length,
          departmentCount: input.department ? 1 : departmentRows.length,
          taskCount: filteredTasks.length,
          overdueTaskCount: filteredTasks.filter(
            (task) => task.status !== "done" && task.plannedEndDate && task.plannedEndDate < today,
          ).length,
          leaveCount: filteredLeaves.length,
          leaveDays: filteredLeaves.reduce((sum, leave) => sum + (leave.days ?? 0), 0),
          activeLeaveCount: activeLeavesNow.length,
          tripCount: cycleFilteredTrips.length,
          tripSubsidyDays: cycleFilteredTrips.reduce((sum, trip) => sum + trip.subsidyDays, 0),
          tripAlertCount: filteredTripAlerts.length,
        },
        departmentRows,
      };
    }),
});
