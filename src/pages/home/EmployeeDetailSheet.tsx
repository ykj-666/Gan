import type { inferRouterOutputs } from "@trpc/server";
import { AlertTriangle, BriefcaseBusiness, CalendarClock, Loader2, Timer } from "lucide-react";
import { TASK_STATUS_META } from "@/lib/task-meta";
import { trpc } from "@/providers/trpc";
import { leaveStatusLabelMap, leaveTypeLabelMap } from "@/pages/attendance/helpers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AppRouter } from "../../../api/router";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type MemberSummary = RouterOutputs["stats"]["dashboard"]["memberStats"][number];

type EmployeeDetailSheetProps = {
  employee: MemberSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warning" | "danger" | "info";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "info"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <p className="text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
      {label}
    </p>
  );
}

export function EmployeeDetailSheet({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailSheetProps) {
  const enabled = open && !!employee;
  const today = new Date().toISOString().slice(0, 10);
  const recentWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: tasks = [], isLoading: tasksLoading } = trpc.task.list.useQuery(
    employee ? { assigneeId: employee.id } : undefined,
    { enabled },
  );
  const { data: leaves = [], isLoading: leavesLoading } = trpc.attendance.list.useQuery(
    employee ? { userId: employee.id } : {},
    { enabled },
  );
  const { data: trips = [], isLoading: tripsLoading } = trpc.businessTrip.list.useQuery(
    employee ? { userId: employee.id } : undefined,
    { enabled },
  );

  const overdueTasks = tasks.filter(
    (task) => task.status !== "done" && !!task.plannedEndDate && task.plannedEndDate < today,
  );
  const activeLeaves = leaves.filter(
    (leave) => leave.status !== "rejected" && leave.startDate <= today && leave.endDate >= today,
  );
  const activeTrips = trips.filter(
    (trip) => trip.dispatchStart <= today && trip.dispatchEnd >= today,
  );
  const tripAlerts = trips.filter((trip) => {
    const cycleDayCount =
      Math.floor((new Date(trip.cycleEnd).getTime() - new Date(trip.cycleStart).getTime()) / 86400000) +
      1;
    return (
      (trip.absenceDays > 0 && !trip.absenceReason?.trim()) ||
      (trip.subsidyDays > cycleDayCount && !trip.remark?.trim())
    );
  });

  const recentCompletedTasks = tasks.filter(
    (task) => task.status === "done" && (task.updatedAt?.toISOString().slice(0, 10) ?? "") >= recentWindowStart,
  );
  const recentLeaveDays = leaves
    .filter((leave) => leave.endDate >= recentWindowStart)
    .reduce((sum, leave) => sum + (leave.days ?? 0), 0);
  const recentTripSubsidyDays = trips
    .filter((trip) => trip.dispatchEnd >= recentWindowStart)
    .reduce((sum, trip) => sum + trip.subsidyDays, 0);

  const timeline = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      category: "任务",
      title: task.projectName,
      subtitle: `${TASK_STATUS_META[task.status]?.label || task.status}${task.projectCode ? ` / ${task.projectCode}` : ""}`,
      date: task.updatedAt?.toISOString().slice(0, 10) ?? task.createdAt?.toISOString().slice(0, 10) ?? "",
      tone: task.status === "done" ? "text-emerald-600" : "text-blue-600",
    })),
    ...leaves.map((leave) => ({
      id: `leave-${leave.id}`,
      category: "请假",
      title: leaveTypeLabelMap[leave.type] || leave.type,
      subtitle: `${leave.startDate} 至 ${leave.endDate} / ${leaveStatusLabelMap[leave.status] || leave.status}`,
      date: leave.endDate,
      tone: leave.status === "rejected" ? "text-red-600" : "text-amber-600",
    })),
    ...trips.map((trip) => ({
      id: `trip-${trip.id}`,
      category: "出差",
      title: `${trip.projectCode} / ${trip.location}`,
      subtitle: `派遣 ${trip.dispatchStart} 至 ${trip.dispatchEnd}`,
      date: trip.dispatchEnd,
      tone: "text-blue-600",
    })),
  ]
    .filter((item) => item.date)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 12);

  const isLoading = tasksLoading || leavesLoading || tripsLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-l sm:w-[760px] sm:max-w-[760px]">
        <SheetHeader className="border-b border-gray-100 px-4 py-5 sm:px-6">
          <SheetTitle className="text-lg">{employee?.name || "员工详情"}</SheetTitle>
          <SheetDescription>
            汇总查看任务、请假和出差情况，直接判断当前负载和异常点。
          </SheetDescription>
          {employee ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="rounded-full bg-gray-100 px-2.5 py-1">
                {employee.department || "未设置部门"}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1">
                {employee.role === "admin" ? "管理员" : "员工"}
              </span>
              {employee.email ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-1">{employee.email}</span>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        {!employee ? null : isLoading ? (
          <div className="flex h-[420px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 px-4 py-5 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="当前负载" value={employee.currentLoad} tone="info" />
              <SummaryCard
                label="逾期任务"
                value={overdueTasks.length}
                tone={overdueTasks.length ? "danger" : "default"}
              />
              <SummaryCard
                label="生效中请假"
                value={activeLeaves.length}
                tone={activeLeaves.length ? "warning" : "default"}
              />
              <SummaryCard
                label="出差异常"
                value={tripAlerts.length}
                tone={tripAlerts.length ? "danger" : "default"}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="近 30 天完成任务" value={recentCompletedTasks.length} />
              <SummaryCard label="近 30 天请假天数" value={recentLeaveDays} />
              <SummaryCard label="近 30 天补贴天数" value={recentTripSubsidyDays} />
              <SummaryCard label="当前现场出差" value={activeTrips.length} />
            </div>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900">当前异常与占用</h3>
              </div>
              {overdueTasks.length || activeLeaves.length || tripAlerts.length ? (
                <div className="space-y-2">
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={`overdue-${task.id}`} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{task.projectName}</p>
                      <p className="mt-1 text-xs text-gray-600">任务已逾期，截止日期 {task.plannedEndDate}</p>
                    </div>
                  ))}
                  {activeLeaves.slice(0, 2).map((leave) => (
                    <div key={`leave-${leave.id}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {leaveTypeLabelMap[leave.type] || leave.type}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {leave.startDate} 至 {leave.endDate}，共 {leave.days ?? 0} 天
                      </p>
                    </div>
                  ))}
                  {tripAlerts.slice(0, 3).map((trip) => (
                    <div key={`trip-${trip.id}`} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {trip.projectCode} / {trip.location}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {trip.absenceDays > 0 && !trip.absenceReason?.trim()
                          ? `缺勤 ${trip.absenceDays} 天但未填写原因`
                          : "补贴天数超过周期但未填写备注"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock label="当前没有待处理异常" />
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">统一时间线</h3>
                </div>
                {timeline.length ? (
                  <div className="space-y-2">
                    {timeline.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.title}</p>
                            <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${item.tone}`}>{item.category}</p>
                            <p className="mt-1 text-xs text-gray-400">{item.date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock label="暂无可展示的时间线记录" />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">当前占用明细</h3>
                </div>

                <div className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-gray-900">请假占用</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    当前生效 {activeLeaves.length} 条，近 30 天累计 {recentLeaveDays} 天
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-gray-900">出差占用</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    当前现场出差 {activeTrips.length} 条，异常 {tripAlerts.length} 条
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-gray-900">任务风险</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    任务总数 {tasks.length}，逾期 {overdueTasks.length}，进行中 {employee.inProgress}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
