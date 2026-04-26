import { trpc } from "@/providers/trpc";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Clock3, Loader2 } from "lucide-react";

const cardConfig = [
  {
    key: "todo",
    label: "待处理任务",
    icon: AlertTriangle,
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.12)",
  },
  {
    key: "inProgress",
    label: "进行中任务",
    icon: Clock3,
    color: "#3B82F6",
    bgColor: "rgba(59, 130, 246, 0.12)",
  },
  {
    key: "done",
    label: "已完成任务",
    icon: CheckCircle2,
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.12)",
  },
  {
    key: "risk",
    label: "当前风险项",
    icon: BriefcaseBusiness,
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.12)",
  },
] as const;

export function MetricCards() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex h-[120px] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ))}
      </div>
    );
  }

  const riskCount =
    stats.managerFocus.overdueTasks.length +
    stats.managerFocus.activeLeaves.length +
    stats.managerFocus.tripAlerts.length;

  const metricMap = {
    todo: {
      count: stats.overview.todo,
      hint: `紧急任务 ${stats.overview.urgent} 项`,
    },
    inProgress: {
      count: stats.overview.inProgress,
      hint: `审核中 ${stats.overview.review} 项`,
    },
    done: {
      count: stats.overview.done,
      hint: `完成率 ${stats.overview.completionRate}%`,
    },
    risk: {
      count: riskCount,
      hint: `本周新增任务 ${stats.overview.thisWeekNew} 项`,
    },
  };

  return (
    <div className="grid grid-cols-4 gap-5">
      {cardConfig.map((metric, index) => {
        const Icon = metric.icon;
        const value = metricMap[metric.key];

        return (
          <div
            key={metric.key}
            className="animate-float-in rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: metric.bgColor }}
              >
                <Icon className="h-4 w-4" style={{ color: metric.color }} />
              </div>
              <span
                className="rounded-full px-2 py-1 text-xs font-semibold"
                style={{ background: metric.bgColor, color: metric.color }}
              >
                {metric.label}
              </span>
            </div>

            <p className="text-3xl font-bold tracking-tight text-gray-900">{value.count}</p>
            <p className="mt-2 text-xs font-medium text-gray-500">{value.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
