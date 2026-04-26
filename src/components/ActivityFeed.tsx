import { trpc } from "@/providers/trpc";
import { CheckCircle2, FilePlus, Loader2, Pencil, RefreshCw, UserCheck } from "lucide-react";

const typeConfig: Record<string, { icon: typeof FilePlus; color: string; bg: string }> = {
  task_created: { icon: FilePlus, color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  task_updated: { icon: Pencil, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  task_assigned: { icon: UserCheck, color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  task_completed: { icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  status_changed: { icon: RefreshCw, color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  user_created: { icon: UserCheck, color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  user_updated: { icon: Pencil, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  user_deleted: { icon: CheckCircle2, color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  user_imported: { icon: FilePlus, color: "#0EA5E9", bg: "rgba(14,165,233,0.12)" },
  leave_created: { icon: FilePlus, color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  leave_deleted: { icon: CheckCircle2, color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  leave_status_changed: { icon: RefreshCw, color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  trip_created: { icon: FilePlus, color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  trip_updated: { icon: Pencil, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  trip_deleted: { icon: CheckCircle2, color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  trip_imported: { icon: FilePlus, color: "#0EA5E9", bg: "rgba(14,165,233,0.12)" },
};

export function ActivityFeed() {
  const { data: activities, isLoading } = trpc.activity.list.useQuery({ limit: 10, days: 14 });

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-bold text-gray-900">最近动作</h3>

      <div className="max-h-[320px] space-y-3 overflow-y-auto scrollbar-thin">
        {!activities?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">暂无动态</p>
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
                className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-gray-50"
              >
                <div
                  className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: config.bg }}
                >
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-gray-700">{activity.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                    <span>{time}</span>
                    <span>{activity.actorName || "系统"}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
