import { AlertTriangle, BarChart3, CalendarCheck2, Users } from "lucide-react";
import { useNavigate } from "react-router";

const shortcuts = [
  {
    icon: AlertTriangle,
    title: "异常处理",
    description: "集中处理逾期任务、请假占用和出差异常。",
    value: "优先收口风险",
    path: "/exceptions",
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    icon: CalendarCheck2,
    title: "考勤管理",
    description: "统一处理请假和出差考勤，支持直接编辑记录。",
    value: "统一考勤入口",
    path: "/attendance",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Users,
    title: "员工负载",
    description: "从员工维度查看当前负载、请假占用和出差异常。",
    value: "按人调配资源",
    path: "/team",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: BarChart3,
    title: "报表导出",
    description: "导出管理月报、任务台账、请假和出差统计。",
    value: "直接产出交付件",
    path: "/reports",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
] as const;

export function FeatureSection() {
  const navigate = useNavigate();

  return (
    <section className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">管理快捷入口</h2>
        <p className="mt-1 text-sm text-gray-500">
          围绕管理者日常动作收敛常用入口，减少跨模块来回查找。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              onClick={() => navigate(item.path)}
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-left transition-all duration-200 hover:border-gray-300 hover:bg-white hover:shadow-sm"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${item.bg}`}>
                <Icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
              <p className="mt-4 text-xs font-medium text-gray-700">{item.value}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
