import { trpc } from "@/providers/trpc";
import { Loader2, Award } from "lucide-react";

export function TeamRadar() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="glass-card p-6 h-[280px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const completionRate = stats.overview.completionRate;
  const conicGradient = `conic-gradient(
    #10B981 0deg ${(completionRate / 100) * 360}deg,
    rgba(16, 185, 129, 0.12) ${(completionRate / 100) * 360}deg 360deg
  )`;

  return (
    <div className="glass-card p-6">
      <h3 className="text-base font-bold text-gray-900 mb-4">团队效率</h3>

      {/* Ring chart */}
      <div className="flex items-center gap-6 mb-5">
        <div className="relative w-24 h-24 flex-shrink-0">
          <div
            className="w-full h-full rounded-full"
            style={{ background: conicGradient }}
          />
          <div className="absolute inset-2 rounded-full bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-900">
              {completionRate}%
            </span>
            <span className="text-[10px] text-gray-500">完成率</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">已完成</span>
            <span className="font-semibold text-emerald-600">
              {stats.overview.done}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">进行中</span>
            <span className="font-semibold text-blue-600">
              {stats.overview.inProgress}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">待处理</span>
            <span className="font-semibold text-red-500">
              {stats.overview.todo}
            </span>
          </div>
        </div>
      </div>

      {/* Member rankings */}
      <div className="space-y-2">
        {stats.memberStats.slice(0, 4).map((member) => {
          const efficiency =
            member.total > 0
              ? Math.round((member.done / member.total) * 100)
              : 0;
          const grade =
            efficiency >= 80 ? "A+" : efficiency >= 60 ? "B+" : "C";
          const gradeColor =
            grade === "A+" ? "#10B981" : grade === "B+" ? "#3B82F6" : "#F59E0B";

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/40 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(member.name ?? "U")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {member.name}
                </p>
                <div className="w-full h-1.5 bg-gray-100/60 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${efficiency}%`,
                      background: gradeColor,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Award className="w-3.5 h-3.5" style={{ color: gradeColor }} />
                <span
                  className="text-xs font-bold"
                  style={{ color: gradeColor }}
                >
                  {grade}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
