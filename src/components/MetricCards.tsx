import { trpc } from "@/providers/trpc";
import { AlertTriangle, Clock, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";

const statusConfig = {
  todo: {
    label: "待处理",
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.12)",
    icon: AlertTriangle,
  },
  in_progress: {
    label: "进行中",
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.12)",
    icon: Clock,
  },
  done: {
    label: "已完成",
    color: "#3B82F6",
    bgColor: "rgba(59, 130, 246, 0.12)",
    icon: CheckCircle2,
  },
};

export function MetricCards() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="glass-card p-6 h-[120px] flex items-center justify-center"
          >
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      key: "todo" as const,
      count: stats.overview.todo,
      change: "+2",
    },
    {
      key: "in_progress" as const,
      count: stats.overview.inProgress,
      change: "+1",
    },
    {
      key: "done" as const,
      count: stats.overview.done,
      change: "+4",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-5">
      {metrics.map((metric) => {
        const config = statusConfig[metric.key];
        const Icon = config.icon;
        return (
          <div
            key={metric.key}
            className="glass-card p-6 animate-float-in"
            style={{ animationDelay: `${metrics.indexOf(metric) * 0.1}s` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: config.bgColor }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <span
                    className="status-badge"
                    style={{
                      background: config.bgColor,
                      color: config.color,
                    }}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">
                  {metric.count}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">
                    {metric.change} 本周
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
