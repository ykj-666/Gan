import { trpc } from "@/providers/trpc";
import { Award, Loader2 } from "lucide-react";

export function TeamRadar() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const completionRate = stats.overview.completionRate;
  const conicGradient = `conic-gradient(
    #10B981 0deg ${(completionRate / 100) * 360}deg,
    rgba(16, 185, 129, 0.12) ${(completionRate / 100) * 360}deg 360deg
  )`;

  const topMembers = [...stats.memberStats]
    .sort((left, right) => right.currentLoad - left.currentLoad)
    .slice(0, 4);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-bold text-gray-900">团队负载</h3>

      <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative h-24 w-24 flex-shrink-0 self-center sm:self-auto">
          <div className="h-full w-full rounded-full" style={{ background: conicGradient }} />
          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-xl font-bold text-gray-900">{completionRate}%</span>
            <span className="text-[10px] text-gray-500">完成率</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">已完成</span>
            <span className="font-semibold text-emerald-600">{stats.overview.done}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">进行中</span>
            <span className="font-semibold text-blue-600">{stats.overview.inProgress}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">待处理</span>
            <span className="font-semibold text-red-500">{stats.overview.todo}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {topMembers.map((member) => {
          const load = Math.min(member.currentLoad * 10, 100);
          const grade = member.currentLoad >= 8 ? "高" : member.currentLoad >= 4 ? "中" : "低";
          const gradeColor =
            grade === "高" ? "#EF4444" : grade === "中" ? "#F59E0B" : "#10B981";

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                {(member.name ?? "U")[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-800">{member.name}</p>
                  <span className="text-xs text-gray-400">{member.currentLoad}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100/60">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${load}%`,
                      background: gradeColor,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <Award className="h-3.5 w-3.5" style={{ color: gradeColor }} />
                <span className="text-xs font-bold" style={{ color: gradeColor }}>
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
