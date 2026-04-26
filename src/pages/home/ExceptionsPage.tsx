import { type ReactNode, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { leaveTypeLabelMap } from "@/pages/attendance/helpers";

function SectionCard({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "red" | "amber" | "blue";
  children: ReactNode;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-blue-200 bg-blue-50";

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">当前筛选结果 {count} 条</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-800 shadow-sm">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
      {label}
    </div>
  );
}

function getLeaveMonthFromDate(dateValue: string) {
  return dateValue.slice(0, 7);
}

function getTripCycleMonth(cycleEnd: string) {
  return cycleEnd.slice(0, 7);
}

export function ExceptionsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("all");
  const [cycleMonth, setCycleMonth] = useState(new Date().toISOString().slice(0, 7));

  const today = new Date().toISOString().slice(0, 10);
  const monthRange = useMemo(() => {
    const [year, month] = cycleMonth.split("-").map(Number);
    return {
      startDate: `${year}-${String(month).padStart(2, "0")}-01`,
      endDate: `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`,
    };
  }, [cycleMonth]);

  const { data: stats } = trpc.stats.dashboard.useQuery();
  const { data: leaveRecords = [], isLoading: leaveLoading } = trpc.attendance.list.useQuery(monthRange);
  const { data: tripRecords = [], isLoading: tripLoading } = trpc.businessTrip.list.useQuery({
    cycleMonth,
    department: department === "all" ? undefined : department,
  });

  const members = stats?.memberStats ?? [];
  const memberDepartmentMap = useMemo(
    () => new Map(members.map((member) => [member.name, member.department || "未设置部门"])),
    [members],
  );
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((member) => member.department?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [members],
  );

  const searchLower = keyword.trim().toLowerCase();

  const overdueTasks = useMemo(() => {
    return (stats?.managerFocus.overdueTasks ?? []).filter((task) => {
      const taskDepartment = memberDepartmentMap.get(task.assigneeName) || "未设置部门";
      const matchDepartment = department === "all" || taskDepartment === department;
      const matchSearch =
        !searchLower ||
        task.projectName.toLowerCase().includes(searchLower) ||
        (task.projectCode?.toLowerCase().includes(searchLower) ?? false) ||
        task.assigneeName.toLowerCase().includes(searchLower);
      return matchDepartment && matchSearch;
    });
  }, [stats?.managerFocus.overdueTasks, memberDepartmentMap, department, searchLower]);

  const activeLeaves = useMemo(() => {
    return leaveRecords.filter((leave) => {
      const matchActive = leave.status !== "rejected" && leave.startDate <= today && leave.endDate >= today;
      const matchDepartment = department === "all" || leave.userDepartment === department;
      const matchSearch =
        !searchLower ||
        leave.userName.toLowerCase().includes(searchLower) ||
        (leave.userDepartment?.toLowerCase().includes(searchLower) ?? false);
      return matchActive && matchDepartment && matchSearch;
    });
  }, [leaveRecords, today, department, searchLower]);

  const tripAlerts = useMemo(() => {
    return tripRecords.filter((trip) => {
      const cycleDayCount =
        Math.floor((new Date(trip.cycleEnd).getTime() - new Date(trip.cycleStart).getTime()) / 86400000) +
        1;
      const hasAlert =
        (trip.absenceDays > 0 && !trip.absenceReason?.trim()) ||
        (trip.subsidyDays > cycleDayCount && !trip.remark?.trim());
      const matchSearch =
        !searchLower ||
        trip.employeeName.toLowerCase().includes(searchLower) ||
        trip.projectCode.toLowerCase().includes(searchLower) ||
        trip.location.toLowerCase().includes(searchLower);
      return hasAlert && matchSearch;
    });
  }, [tripRecords, searchLower]);

  const isLoading = !stats || leaveLoading || tripLoading;

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">异常工作台</h1>
          <p className="text-xs text-gray-500">集中处理任务逾期、请假占用和出差异常</p>
        </div>
      </header>

      <main className="space-y-5 px-4 pb-6 sm:px-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索员工、项目编号、项目名、地点"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="all">全部部门</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={cycleMonth}
              onChange={(event) => setCycleMonth(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
            />
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p>加载中...</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-3">
            <SectionCard title="逾期任务" count={overdueTasks.length} tone="red">
              {overdueTasks.length ? (
                <div className="space-y-3">
                  {overdueTasks.map((task) => (
                    <div key={task.id} className="rounded-xl border border-white/80 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{task.projectName}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {task.assigneeName} / {memberDepartmentMap.get(task.assigneeName) || "未设置部门"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            截止 {task.plannedEndDate} / 项目编号 {task.projectCode || "-"}
                          </p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          逾期 {task.overdueDays} 天
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          navigate(
                            `/board?search=${encodeURIComponent(task.projectCode || task.projectName)}`,
                          )
                        }
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-700"
                      >
                        直接处理
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="当前没有逾期任务" />
              )}
            </SectionCard>

            <SectionCard title="今日请假占用" count={activeLeaves.length} tone="amber">
              {activeLeaves.length ? (
                <div className="space-y-3">
                  {activeLeaves.map((leave) => (
                    <div key={leave.id} className="rounded-xl border border-white/80 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{leave.userName}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {leave.userDepartment || "未设置部门"} / {leaveTypeLabelMap[leave.type] || leave.type}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {leave.startDate} 至 {leave.endDate}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                          {leave.days ?? 0} 天
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          navigate(
                            `/attendance?tab=leave&month=${encodeURIComponent(
                              getLeaveMonthFromDate(leave.startDate),
                            )}&userId=${leave.userId}&editLeaveId=${leave.id}`,
                          )
                        }
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-700"
                      >
                        直接处理
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="当前没有生效中的请假占用" />
              )}
            </SectionCard>

            <SectionCard title="出差异常" count={tripAlerts.length} tone="blue">
              {tripAlerts.length ? (
                <div className="space-y-3">
                  {tripAlerts.map((trip) => {
                    const cycleDayCount =
                      Math.floor(
                        (new Date(trip.cycleEnd).getTime() - new Date(trip.cycleStart).getTime()) /
                          86400000,
                      ) + 1;
                    const message =
                      trip.absenceDays > 0 && !trip.absenceReason?.trim()
                        ? `缺勤 ${trip.absenceDays} 天但未填写原因`
                        : `补贴 ${trip.subsidyDays} 天，超过周期 ${cycleDayCount} 天但未备注`;

                    return (
                      <div key={trip.id} className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {trip.employeeName} / {trip.projectCode}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {trip.department} / {trip.location}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">{message}</p>
                          </div>
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-600" />
                        </div>
                        <button
                          onClick={() =>
                            navigate(
                              `/attendance?tab=trip&cycleMonth=${encodeURIComponent(
                                getTripCycleMonth(trip.cycleEnd),
                              )}&department=${encodeURIComponent(trip.department)}&search=${encodeURIComponent(
                                trip.employeeName,
                              )}&editTripId=${trip.id}`,
                            )
                          }
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                        >
                          直接处理
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState label="当前没有出差异常" />
              )}
            </SectionCard>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-medium text-gray-900">任务风险</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{overdueTasks.length}</p>
            <p className="mt-1 text-xs text-gray-500">需优先排产和人力回收</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-900">在岗占用</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{activeLeaves.length}</p>
            <p className="mt-1 text-xs text-gray-500">今日请假人员占用</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium text-gray-900">出差异常</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{tripAlerts.length}</p>
            <p className="mt-1 text-xs text-gray-500">需要补充原因或备注</p>
          </div>
        </section>
      </main>
    </>
  );
}
