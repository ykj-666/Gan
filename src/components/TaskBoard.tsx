import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Plus, Loader2 } from "lucide-react";
import type { Task } from "@db/schema";

const columns = [
  { key: "todo" as const, label: "待处理", color: "#EF4444", gradient: "from-red-400 to-rose-500" },
  { key: "in_progress" as const, label: "进行中", color: "#10B981", gradient: "from-emerald-400 to-teal-500" },
  { key: "review" as const, label: "审核中", color: "#F59E0B", gradient: "from-amber-400 to-yellow-500" },
  { key: "done" as const, label: "已完成", color: "#3B82F6", gradient: "from-blue-400 to-indigo-500" },
];

const priorityMap: Record<string, { label: string; color: string }> = {
  low: { label: "低", color: "#6B7280" },
  medium: { label: "中", color: "#3B82F6" },
  high: { label: "高", color: "#F59E0B" },
  urgent: { label: "紧急", color: "#EF4444" },
};

interface TaskBoardProps {
  onEditTask: (task: Task) => void;
  onCreateTask: () => void;
}

export function TaskBoard({ onEditTask, onCreateTask }: TaskBoardProps) {
  const utils = trpc.useUtils();
  const { data: allTasks, isLoading } = trpc.task.list.useQuery({});
  const updateStatus = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.stats.dashboard.invalidate();
    },
  });

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (taskId: number) => {
    setDraggingId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDrop = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggingId) {
      updateStatus.mutate({ id: draggingId, status: columnKey as "todo" | "in_progress" | "review" | "done" });
    }
    setDraggingId(null);
    setDragOverColumn(null);
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">任务看板</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            拖拽任务卡片变更状态
          </p>
        </div>
        <button
          onClick={onCreateTask}
          className="btn-jelly flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-500/25"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Plus className="w-4 h-4" />
          新建任务
        </button>
      </div>

      <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
        {columns.map((col) => {
          const colTasks = allTasks?.filter((t) => t.status === col.key) ?? [];
          const isDragOver = dragOverColumn === col.key;

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl transition-all duration-200 ${
                isDragOver ? "bg-white/40 ring-2 ring-offset-1" : "bg-white/20"
              }`}
              style={isDragOver ? { boxShadow: `0 0 0 2px ${col.color}` } : {}}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: col.color }}
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    {col.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-400 bg-white/50 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
                {colTasks.map((task) => {
                  const pr = priorityMap[task.priority] ?? priorityMap.medium;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => onEditTask(task)}
                      className={`p-3 rounded-xl bg-white/70 hover:bg-white/90 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm hover:shadow-md ${
                        draggingId === task.id ? "opacity-40 scale-95" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800 mb-2 line-clamp-2">
                        {task.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            color: pr.color,
                            background: `${pr.color}18`,
                          }}
                        >
                          {pr.label}
                        </span>
                        {task.dueDate && (
                          <span className="text-[11px] text-gray-400">
                            {new Date(task.dueDate).toLocaleDateString("zh-CN", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      {task.tag && (
                        <span className="inline-block mt-2 text-[11px] text-gray-500 bg-gray-100/80 px-2 py-0.5 rounded-md">
                          {task.tag}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
