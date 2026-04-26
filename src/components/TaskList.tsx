import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  ArrowUpDown,
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { TASK_PRIORITY_META, TASK_STATUS_META, TASK_STATUS_OPTIONS } from "@/lib/task-meta";
import type { TaskListItem } from "@/types/task";

interface TaskListProps {
  onEditTask: (task: TaskListItem) => void;
  onCreateTask: () => void;
}

export function TaskList({ onEditTask, onCreateTask }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.task.list.useQuery({
    status:
      statusFilter !== "all"
        ? (statusFilter as "todo" | "in_progress" | "review" | "done")
        : undefined,
    search: search.trim() || undefined,
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      void utils.task.list.invalidate();
      void utils.stats.dashboard.invalidate();
    },
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">任务列表</h2>
          <p className="mt-0.5 text-sm text-gray-500">{tasks?.length ?? 0} 个任务</p>
        </div>
        <button
          onClick={onCreateTask}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建任务
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目名称或编号"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">全部状态</option>
            {TASK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="-mx-2 flex-1 overflow-y-auto px-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !tasks?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ArrowUpDown className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const status = TASK_STATUS_META[task.status] ?? TASK_STATUS_META.todo;
              const priority = TASK_PRIORITY_META[task.priority] ?? TASK_PRIORITY_META.medium;

              return (
                <div
                  key={task.id}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-gray-50"
                  onClick={() => onEditTask(task)}
                >
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ background: status.color }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-800 transition-colors group-hover:text-indigo-700">
                        {task.projectName}
                      </p>
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ color: priority.color, background: `${priority.color}18` }}
                      >
                        {priority.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3">
                      <span
                        className="status-badge text-[11px]"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                      {task.projectCode ? (
                        <span className="text-xs text-gray-400">{task.projectCode}</span>
                      ) : null}
                      {task.projectType ? (
                        <span className="rounded-md bg-gray-100/60 px-2 py-0.5 text-xs text-gray-400">
                          {task.projectType}
                        </span>
                      ) : null}
                      {task.assigneeName ? (
                        <span className="text-xs text-gray-500">{task.assigneeName}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuId(openMenuId === task.id ? null : task.id);
                      }}
                      className="rounded-lg p-1.5 opacity-0 transition-all duration-200 hover:bg-gray-100 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                    </button>

                    {openMenuId === task.id ? (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full z-50 mt-1 w-40 space-y-0.5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm shadow-xl">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditTask(task);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            编辑任务
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteTask.mutate({ id: task.id });
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除任务
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
