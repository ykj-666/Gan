import { useMemo } from "react";
import { ArrowRight, CalendarCheck2, Loader2, Search, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { leaveTypeLabelMap } from "@/pages/attendance/helpers";

function ResultBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function getLeaveMonth(dateValue: string) {
  return dateValue.slice(0, 7);
}

function getTripCycleMonth(cycleEnd: string) {
  return cycleEnd.slice(0, 7);
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("q")?.trim() ?? "";
  const enabled = keyword.length > 0;

  const { data: users = [], isLoading: usersLoading } = trpc.user.list.useQuery(
    { search: keyword || undefined },
    { enabled },
  );
  const { data: tasks = [], isLoading: tasksLoading } = trpc.task.list.useQuery(
    { search: keyword || undefined },
    { enabled },
  );
  const { data: trips = [], isLoading: tripsLoading } = trpc.businessTrip.list.useQuery(
    { search: keyword || undefined },
    { enabled },
  );
  const { data: leaves = [], isLoading: leavesLoading } = trpc.attendance.list.useQuery(
    { search: keyword || undefined },
    { enabled },
  );

  const limitedUsers = useMemo(() => users.slice(0, 6), [users]);
  const limitedTasks = useMemo(() => tasks.slice(0, 6), [tasks]);
  const limitedTrips = useMemo(() => trips.slice(0, 6), [trips]);
  const limitedLeaves = useMemo(() => leaves.slice(0, 6), [leaves]);
  const isLoading = enabled && (usersLoading || tasksLoading || tripsLoading || leavesLoading);

  return (
    <>
      <header className="flex h-[64px] items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">全局搜索</h1>
          <p className="text-xs text-gray-500">统一检索员工、任务、请假和出差记录</p>
        </div>
      </header>

      <main className="space-y-5 px-6 pb-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 rounded-xl border border-gray-300 px-4 py-3">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={keyword}
              onChange={(event) => {
                const params = new URLSearchParams(searchParams);
                if (event.target.value.trim()) params.set("q", event.target.value.trim());
                else params.delete("q");
                setSearchParams(params, { replace: true });
              }}
              placeholder="搜索员工、部门、项目、请假原因、出差地点"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
        </section>

        {!enabled ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 shadow-sm">
            请输入关键字后再搜索
          </div>
        ) : isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 shadow-sm">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span>搜索中...</span>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">员工结果</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">任务结果</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{tasks.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">请假结果</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{leaves.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">出差结果</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{trips.length}</p>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <ResultBlock title="员工" count={users.length}>
                {limitedUsers.length ? (
                  <div className="space-y-3">
                    {limitedUsers.map((user) => (
                      <div key={user.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {user.department || "未设置部门"} / {user.role === "admin" ? "管理员" : "员工"}
                            </p>
                          </div>
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <Link
                          to={`/team?search=${encodeURIComponent(keyword)}&memberId=${user.id}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                        >
                          打开员工详情
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                    <Link
                      to={`/team?search=${encodeURIComponent(keyword)}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"
                    >
                      带条件打开员工页
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">没有匹配的员工</p>
                )}
              </ResultBlock>

              <ResultBlock title="任务" count={tasks.length}>
                {limitedTasks.length ? (
                  <div className="space-y-3">
                    {limitedTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{task.projectName}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {task.projectCode || "未填写项目编号"}
                          {task.assigneeName ? ` / ${task.assigneeName}` : ""}
                        </p>
                        <Link
                          to={`/board?search=${encodeURIComponent(task.projectCode || task.projectName)}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                        >
                          打开任务看板
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                    <Link
                      to={`/board?search=${encodeURIComponent(keyword)}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"
                    >
                      带条件打开任务看板
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">没有匹配的任务</p>
                )}
              </ResultBlock>

              <ResultBlock title="请假记录" count={leaves.length}>
                {limitedLeaves.length ? (
                  <div className="space-y-3">
                    {limitedLeaves.map((leave) => (
                      <div key={leave.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{leave.userName}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {leave.userDepartment || "未设置部门"} / {leaveTypeLabelMap[leave.type] || leave.type}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {leave.startDate} 至 {leave.endDate}
                            </p>
                          </div>
                          <CalendarCheck2 className="h-4 w-4 text-amber-500" />
                        </div>
                        <Link
                          to={`/attendance?tab=leave&month=${encodeURIComponent(
                            getLeaveMonth(leave.startDate),
                          )}&userId=${leave.userId}&editLeaveId=${leave.id}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                        >
                          打开请假记录
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">没有匹配的请假记录</p>
                )}
              </ResultBlock>

              <ResultBlock title="出差记录" count={trips.length}>
                {limitedTrips.length ? (
                  <div className="space-y-3">
                    {limitedTrips.map((trip) => (
                      <div key={trip.id} className="rounded-xl border border-gray-200 px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {trip.employeeName} / {trip.projectCode}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {trip.department} / {trip.location}
                        </p>
                        <Link
                          to={`/attendance?tab=trip&cycleMonth=${encodeURIComponent(
                            getTripCycleMonth(trip.cycleEnd),
                          )}&department=${encodeURIComponent(trip.department)}&search=${encodeURIComponent(
                            trip.employeeName,
                          )}&editTripId=${trip.id}`}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                        >
                          打开出差记录
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                    <Link
                      to={`/attendance?tab=trip&search=${encodeURIComponent(keyword)}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"
                    >
                      带条件打开出差模块
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">没有匹配的出差记录</p>
                )}
              </ResultBlock>
            </div>
          </>
        )}
      </main>
    </>
  );
}
