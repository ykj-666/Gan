import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { TaskBoard } from "@/components/TaskBoard";
import { trpc } from "@/providers/trpc";
import type { Task } from "@db/schema";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-meta";

const SmartTaskRecognition = lazy(() => import("@/components/SmartTaskRecognition"));
const TaskModal = lazy(() =>
  import("@/components/TaskModal").then((module) => ({ default: module.TaskModal })),
);

export function BoardPage() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartTaskOpen, setIsSmartTaskOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "all");
  const [assigneeId, setAssigneeId] = useState(searchParams.get("assigneeId") ?? "all");
  const { data: userList = [] } = trpc.user.list.useQuery();

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setPriority(searchParams.get("priority") ?? "all");
    setAssigneeId(searchParams.get("assigneeId") ?? "all");
  }, [searchParams]);

  const syncParams = (next: { search?: string; priority?: string; assigneeId?: string }) => {
    const params = new URLSearchParams(searchParams);

    if (next.search !== undefined) {
      if (next.search.trim()) params.set("search", next.search.trim());
      else params.delete("search");
    }

    if (next.priority !== undefined) {
      if (next.priority !== "all") params.set("priority", next.priority);
      else params.delete("priority");
    }

    if (next.assigneeId !== undefined) {
      if (next.assigneeId !== "all") params.set("assigneeId", next.assigneeId);
      else params.delete("assigneeId");
    }

    setSearchParams(params, { replace: true });
  };

  const activeFilterCount = useMemo(() => {
    return [Boolean(search.trim()), priority !== "all", assigneeId !== "all"].filter(Boolean).length;
  }, [assigneeId, priority, search]);

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">任务看板</h1>
            <p className="text-xs text-gray-500">
              按状态调整任务，筛选条件会保存在地址参数里，便于复用。
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_220px_auto_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearch(next);
                  syncParams({ search: next });
                }}
                placeholder="搜索项目名、编号、负责人"
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={priority}
              onChange={(event) => {
                const next = event.target.value;
                setPriority(next);
                syncParams({ priority: next });
              }}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">全部优先级</option>
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={assigneeId}
              onChange={(event) => {
                const next = event.target.value;
                setAssigneeId(next);
                syncParams({ assigneeId: next });
              }}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">全部负责人</option>
              {userList.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || `用户-${user.id}`}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsSmartTaskOpen(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
            >
              <Sparkles className="h-4 w-4" />
              智能识别
            </button>

            <button
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              新建任务
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 space-y-4 px-4 pb-6 sm:px-6">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          当前激活筛选 {activeFilterCount} 项
        </div>

        <TaskBoard
          search={search}
          priority={
            priority === "all" ? undefined : (priority as "low" | "medium" | "high" | "urgent")
          }
          assigneeId={assigneeId === "all" ? undefined : Number(assigneeId)}
          onEditTask={(task) => {
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          onCreateTask={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
        />
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
            userList={userList}
          />
        ) : null}
      </Suspense>
    </>
  );
}
