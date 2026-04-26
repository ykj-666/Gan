import { lazy, Suspense, useState } from "react";
import { Bell, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { TaskList } from "@/components/TaskList";
import { trpc } from "@/providers/trpc";
import type { Task } from "@db/schema";
import { ManagerFocusPanel } from "@/components/ManagerFocusPanel";

const ActivityFeed = lazy(() =>
  import("@/components/ActivityFeed").then((module) => ({ default: module.ActivityFeed })),
);
const FeatureSection = lazy(() =>
  import("@/components/FeatureSection").then((module) => ({ default: module.FeatureSection })),
);
const MetricCards = lazy(() =>
  import("@/components/MetricCards").then((module) => ({ default: module.MetricCards })),
);
const SmartTaskRecognition = lazy(() => import("@/components/SmartTaskRecognition"));
const TaskModal = lazy(() =>
  import("@/components/TaskModal").then((module) => ({ default: module.TaskModal })),
);
const TeamRadar = lazy(() =>
  import("@/components/TeamRadar").then((module) => ({ default: module.TeamRadar })),
);

export function DashboardPage() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartTaskOpen, setIsSmartTaskOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: userList } = trpc.user.list.useQuery();
  const navigate = useNavigate();

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">仪表盘</h1>
            <p className="text-xs text-gray-500">汇总查看任务、人力占用和异常风险</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <button
              onClick={() => setIsSmartTaskOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
            >
              <Sparkles className="h-4 w-4" />
              智能识别
            </button>
            <div className="relative min-w-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && search.trim()) {
                    navigate(`/search?q=${encodeURIComponent(search.trim())}`);
                  }
                }}
                placeholder="搜索员工、任务、出差、请假"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
              title="提醒"
            >
              <Bell className="h-5 w-5 text-gray-500" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-5 overflow-y-auto px-4 pb-6 sm:px-6 scrollbar-thin">
        <Suspense fallback={<RouteLoading label="统计加载中..." />}>
          <MetricCards />
        </Suspense>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5">
            <TaskList
              onEditTask={(task) => {
                setEditingTask(task);
                setIsModalOpen(true);
              }}
              onCreateTask={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
            />
          </div>

          <div className="space-y-5">
            <ManagerFocusPanel />
            <Suspense fallback={<RouteLoading label="团队数据加载中..." />}>
              <TeamRadar />
              <ActivityFeed />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<RouteLoading label="功能模块加载中..." />}>
          <FeatureSection />
        </Suspense>
      </main>

      <Suspense fallback={<RouteLoading label="模块加载中..." />}>
        {isModalOpen ? (
          <TaskModal
            task={editingTask}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingTask(null);
            }}
          />
        ) : null}

        {isSmartTaskOpen ? (
          <SmartTaskRecognition
            isOpen={isSmartTaskOpen}
            onClose={() => setIsSmartTaskOpen(false)}
            userList={userList ?? []}
          />
        ) : null}
      </Suspense>
    </>
  );
}
