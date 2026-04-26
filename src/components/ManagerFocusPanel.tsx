import { trpc } from "@/providers/trpc";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Loader2,
  TimerReset,
} from "lucide-react";
import { leaveTypeLabelMap } from "@/pages/attendance/helpers";

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-gray-400">{label}</p>;
}

export function ManagerFocusPanel() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex h-[280px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const { overdueTasks, activeLeaves, tripAlerts } = stats.managerFocus;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">管理者待关注</h3>
        <p className="mt-1 text-xs text-gray-500">
          把跨模块异常和在岗占用集中到一个入口，先看风险，再回到原模块处理。
        </p>
      </div>

      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center gap-2">
            <TimerReset className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-gray-900">逾期任务</h4>
          </div>
          {overdueTasks.length ? (
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {task.projectName}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {task.assigneeName} / 截止 {task.plannedEndDate}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      逾期 {task.overdueDays} 天
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="当前没有逾期任务" />
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-gray-900">今日请假占用</h4>
          </div>
          {activeLeaves.length ? (
            <div className="space-y-2">
              {activeLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{leave.userName}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {leave.department || "未设置部门"} /{" "}
                        {leaveTypeLabelMap[leave.type] || leave.type}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {leave.days} 天
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="当前没有生效中的请假记录" />
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h4 className="text-sm font-semibold text-gray-900">出差异常</h4>
          </div>
          {tripAlerts.length ? (
            <div className="space-y-2">
              {tripAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {alert.employeeName} / {alert.projectCode}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="当前没有待处理的出差异常" />
          )}
        </section>
      </div>
    </div>
  );
}
