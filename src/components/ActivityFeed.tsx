import { trpc } from "@/providers/trpc";
import { Loader2, FilePlus, Pencil, UserCheck, CheckCircle2, RefreshCw } from "lucide-react";

const typeConfig: Record<string, { icon: typeof FilePlus; color: string; bg: string }> = {
  task_created: { icon: FilePlus, color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  task_updated: { icon: Pencil, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  task_assigned: { icon: UserCheck, color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  task_completed: { icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  status_changed: { icon: RefreshCw, color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};

export function ActivityFeed() {
  const { data: activities, isLoading } = trpc.activity.list.useQuery({ limit: 10 });

  if (isLoading) {
    return (
      <div className="glass-card p-6 h-[300px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">最近动态</h3>

      <div className="space-y-3 max-h-[320px] overflow-y-auto scrollbar-thin">
        {!activities?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">暂无动态</p>
        ) : (
          activities.map((activity) => {
            const config = typeConfig[activity.type] ?? typeConfig.task_created;
            const Icon = config.icon;
            const time = activity.createdAt
              ? new Date(activity.createdAt).toLocaleString("zh-CN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/40 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: config.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">
                    {activity.description}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
