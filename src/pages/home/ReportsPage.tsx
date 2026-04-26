import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Filter } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { downloadCsv } from "@/lib/export";
import {
  downloadBase64File,
  getMonthDateRange,
  leaveStatusLabelMap,
  leaveTypeLabelMap,
} from "@/pages/attendance/helpers";
import { TASK_PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";

export function ReportsPage() {
  const [cycleMonth, setCycleMonth] = useState(new Date().toISOString().slice(0, 7));
  const [leaveMonth, setLeaveMonth] = useState(new Date().toISOString().slice(0, 7));
  const [department, setDepartment] = useState("all");

  const leaveRange = useMemo(() => getMonthDateRange(leaveMonth), [leaveMonth]);
  const { data: stats } = trpc.stats.dashboard.useQuery();
  const { data: summary } = trpc.stats.reportSummary.useQuery({
    cycleMonth,
    leaveMonth,
    department: department === "all" ? undefined : department,
  });
  const { data: leaveRecords = [] } = trpc.attendance.list.useQuery(leaveRange);
  const { data: tripRecords = [] } = trpc.businessTrip.list.useQuery({
    cycleMonth,
    department: department === "all" ? undefined : department,
  });
  const { data: tasks = [] } = trpc.task.list.useQuery();
  const exportTripMutation = trpc.businessTrip.exportXlsx.useMutation();

  const members = stats?.memberStats ?? [];
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

  const taskMemberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const filteredTaskRows = useMemo(() => {
    return tasks.filter((task) => {
      if (department === "all") return true;
      const member = task.assigneeId ? taskMemberMap.get(task.assigneeId) : undefined;
      return member?.department === department;
    });
  }, [tasks, department, taskMemberMap]);

  const filteredLeaveRows = useMemo(() => {
    return leaveRecords.filter((leave) => {
      return department === "all" || leave.userDepartment === department;
    });
  }, [leaveRecords, department]);

  const exportLeaveCsv = () => {
    downloadCsv(
      `请假记录-${leaveMonth}${department === "all" ? "" : `-${department}`}.csv`,
      ["员工", "部门", "类型", "开始日期", "结束日期", "天数", "状态", "原因"],
      filteredLeaveRows.map((leave) => [
        leave.userName,
        leave.userDepartment || "",
        leaveTypeLabelMap[leave.type] || leave.type,
        leave.startDate,
        leave.endDate,
        leave.days ?? "",
        leaveStatusLabelMap[leave.status] || leave.status,
        leave.reason || "",
      ]),
    );
  };

  const exportTaskCsv = () => {
    downloadCsv(
      `任务台账-${department === "all" ? "全部部门" : department}.csv`,
      ["项目名称", "项目编号", "负责人", "部门", "状态", "优先级", "开始日期", "截止日期", "备注"],
      filteredTaskRows.map((task) => {
        const member = task.assigneeId ? taskMemberMap.get(task.assigneeId) : undefined;
        return [
          task.projectName,
          task.projectCode || "",
          task.assigneeName || "",
          member?.department || "",
          TASK_STATUS_META[task.status]?.label || task.status,
          TASK_PRIORITY_META[task.priority]?.label || task.priority,
          task.plannedStartDate || "",
          task.plannedEndDate || "",
          task.remark || "",
        ];
      }),
    );
  };

  const exportMemberCsv = () => {
    downloadCsv(
      `员工汇总-${department === "all" ? "全部部门" : department}.csv`,
      [
        "姓名",
        "部门",
        "角色",
        "任务总数",
        "已完成",
        "进行中",
        "待处理",
        "审核中",
        "逾期任务",
        "当前请假",
        "出差异常",
        "完成率",
      ],
      members
        .filter((member) => department === "all" || member.department === department)
        .map((member) => [
          member.name,
          member.department || "",
          member.role === "admin" ? "管理员" : "员工",
          member.total,
          member.done,
          member.inProgress,
          member.todo,
          member.review,
          member.overdue,
          member.activeLeaveCount,
          member.tripAlertCount,
          `${member.efficiency}%`,
        ]),
    );
  };

  const exportManagerMonthlyCsv = () => {
    if (!summary) return;

    const rows: Array<Array<string | number>> = [
      ["汇总", "统计范围", `${summary.scope.department} / ${summary.scope.cycleLabel} / 请假月 ${summary.scope.leaveMonth}`],
      ["汇总", "员工数", summary.summary.headcount],
      ["汇总", "部门数", summary.summary.departmentCount],
      ["汇总", "任务数", summary.summary.taskCount],
      ["汇总", "逾期任务", summary.summary.overdueTaskCount],
      ["汇总", "请假记录", summary.summary.leaveCount],
      ["汇总", "请假天数", summary.summary.leaveDays],
      ["汇总", "今日请假占用", summary.summary.activeLeaveCount],
      ["汇总", "出差记录", summary.summary.tripCount],
      ["汇总", "补贴天数", summary.summary.tripSubsidyDays],
      ["汇总", "出差异常", summary.summary.tripAlertCount],
      ...summary.departmentRows.flatMap((row) => [
        ["部门", `${row.department}-员工数`, row.headcount],
        ["部门", `${row.department}-任务数`, row.taskCount],
        ["部门", `${row.department}-逾期任务`, row.overdueTaskCount],
        ["部门", `${row.department}-请假记录`, row.leaveCount],
        ["部门", `${row.department}-请假天数`, row.leaveDays],
        ["部门", `${row.department}-出差记录`, row.tripCount],
        ["部门", `${row.department}-补贴天数`, row.tripSubsidyDays],
        ["部门", `${row.department}-出差异常`, row.tripAlertCount],
      ]),
    ];

    downloadCsv(`管理月报-${summary.scope.cycleLabel}.csv`, ["层级", "指标", "值"], rows);
  };

  const summaryCards = [
    { label: "员工数", value: summary?.summary.headcount ?? 0 },
    { label: "逾期任务", value: summary?.summary.overdueTaskCount ?? 0 },
    { label: "请假记录", value: summary?.summary.leaveCount ?? 0 },
    { label: "出差异常", value: summary?.summary.tripAlertCount ?? 0 },
  ];

  return (
    <>
      <header className="flex h-[64px] items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">报表中心</h1>
          <p className="text-xs text-gray-500">统一导出出差、请假、任务和管理月报</p>
        </div>
      </header>

      <main className="space-y-5 px-6 pb-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[180px_180px_180px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">出差考勤周期</label>
              <input
                type="month"
                value={cycleMonth}
                onChange={(event) => setCycleMonth(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">请假统计月份</label>
              <input
                type="month"
                value={leaveMonth}
                onChange={(event) => setLeaveMonth(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">部门筛选</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="h-10 w-full bg-transparent text-sm text-gray-700 outline-none"
                >
                  <option value="all">全部部门</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              <h3 className="text-base font-semibold text-gray-900">标准导出</h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  const result = await exportTripMutation.mutateAsync({
                    cycleMonth,
                    department: department === "all" ? undefined : department,
                  });
                  downloadBase64File(result.fileName, result.fileBase64);
                }}
                disabled={exportTripMutation.isPending}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">出差考勤 Excel</p>
                  <p className="mt-1 text-xs text-gray-500">复用正式模板，适合打印上交</p>
                </div>
                <Download className="h-4 w-4 text-gray-500" />
              </button>

              <button
                onClick={exportManagerMonthlyCsv}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">管理月报 CSV</p>
                  <p className="mt-1 text-xs text-gray-500">导出汇总指标和部门拆分统计</p>
                </div>
                <Download className="h-4 w-4 text-gray-500" />
              </button>

              <button
                onClick={exportLeaveCsv}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">请假记录 CSV</p>
                  <p className="mt-1 text-xs text-gray-500">按月份和部门导出请假台账</p>
                </div>
                <Download className="h-4 w-4 text-gray-500" />
              </button>

              <button
                onClick={exportTaskCsv}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">任务台账 CSV</p>
                  <p className="mt-1 text-xs text-gray-500">导出项目、状态、优先级、负责人和计划日期</p>
                </div>
                <Download className="h-4 w-4 text-gray-500" />
              </button>

              <button
                onClick={exportMemberCsv}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">员工汇总 CSV</p>
                  <p className="mt-1 text-xs text-gray-500">导出任务量、逾期、请假和出差异常负载</p>
                </div>
                <Download className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <h3 className="text-base font-semibold text-gray-900">管理汇总</h3>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">统计范围</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {summary?.scope.department ?? "全部部门"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">出差周期</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {summary?.scope.cycleLabel ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">请假天数</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {summary?.summary.leaveDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">出差补贴天数</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {summary?.summary.tripSubsidyDays ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">部门拆分</h3>
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">部门</th>
                      <th className="px-4 py-3 font-medium">员工</th>
                      <th className="px-4 py-3 font-medium">逾期任务</th>
                      <th className="px-4 py-3 font-medium">请假</th>
                      <th className="px-4 py-3 font-medium">出差异常</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.departmentRows.length ? (
                      summary.departmentRows.map((row) => (
                        <tr key={row.department} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-gray-900">{row.department}</td>
                          <td className="px-4 py-3 text-gray-700">{row.headcount}</td>
                          <td className="px-4 py-3 text-gray-700">{row.overdueTaskCount}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.leaveCount} / {row.leaveDays} 天
                          </td>
                          <td className="px-4 py-3 text-gray-700">{row.tripAlertCount}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                          当前条件下没有可汇总的数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">任务记录</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{filteredTaskRows.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">请假记录</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{filteredLeaveRows.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">出差记录</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{tripRecords.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">员工汇总</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {members.filter((member) => department === "all" || member.department === department).length}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
