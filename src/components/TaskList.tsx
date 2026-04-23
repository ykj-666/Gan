import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import type { Task } from "@db/schema";

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "待处理", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  in_progress: { label: "进行中", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  review: { label: "审核中", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  done: { label: "已完成", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
};

const priorityMap: Record<string, { label: string; color: string }> = {
  low: { label: "低", color: "#6B7280" },
  medium: { label: "中", color: "#3B82F6" },
  high: { label: "高", color: "#F59E0B" },
  urgent: { label: "紧急", color: "#EF4444" },
};

interface TaskListProps {
  onEditTask: (task: Task) => void;
  onCreateTask: () => void;
}

export function TaskList({ onEditTask, onCreateTask }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.task.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter as "todo" | "in_progress" | "review" | "done" } : {}
  );
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  const filteredTasks = tasks?.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-card p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">任务列表</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredTasks?.length ?? 0} 个任务
          </p>
        </div>
        <button
          onClick={onCreateTask}
          className="btn-jelly flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Plus className="w-4 h-4" />
          新建任务
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索任务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-input px-3 py-2.5 text-sm text-gray-700 cursor-pointer"
          >
            <option value="all">全部状态</option>
            <option value="todo">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="review">审核中</option>
            <option value="done">已完成</option>
          </select>
        </div>
      </div>

      {/* Task items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin -mx-2 px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !filteredTasks?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ArrowUpDown className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">暂无任务</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const st = statusMap[task.status] ?? statusMap.todo;
              const pr = priorityMap[task.priority] ?? priorityMap.medium;
              return (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 p-3 rounded-xl hover:bg-white/50 transition-all duration-200 cursor-pointer"
                  onClick={() => onEditTask(task)}
                >
                  {/* Status dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: st.color }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">
                        {task.title}
                      </p>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: pr.color, background: `${pr.color}18` }}
                      >
                        {pr.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className="status-badge text-[11px]"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs text-gray-400">
                          截止 {new Date(task.dueDate).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                      {task.tag && (
                        <span className="text-xs text-gray-400 bg-gray-100/60 px-2 py-0.5 rounded-md">
                          {task.tag}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === task.id ? null : task.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>
                    {openMenuId === task.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-40 glass-card shadow-xl z-50 p-1.5 space-y-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white/60 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑任务
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask.mutate({ id: task.id });
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50/60 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除任务
                          </button>
                        </div>
                      </>
                    )}
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
