import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TASK_PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";
import type { TaskListItem } from "@/types/task";

const columns = [
  { key: "todo", ...TASK_STATUS_META.todo },
  { key: "in_progress", ...TASK_STATUS_META.in_progress },
  { key: "review", ...TASK_STATUS_META.review },
  { key: "done", ...TASK_STATUS_META.done },
] as const;

interface TaskBoardProps {
  onEditTask: (task: TaskListItem) => void;
  onCreateTask: () => void;
  search?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigneeId?: number;
}

export function TaskBoard({
  onEditTask,
  onCreateTask,
  search = "",
  priority,
  assigneeId,
}: TaskBoardProps) {
  const utils = trpc.useUtils();
  const { data: allTasks, isLoading } = trpc.task.list.useQuery({
    search: search.trim() || undefined,
    priority,
    assigneeId,
  });
  const updateStatus = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      void utils.task.list.invalidate();
      void utils.stats.dashboard.invalidate();
    },
  });

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (taskId: number) => {
    setDraggingId(taskId);
  };

  const handleDragOver = (event: React.DragEvent, columnKey: string) => {
    event.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDrop = (event: React.DragEvent, columnKey: string) => {
    event.preventDefault();
    if (draggingId) {
      updateStatus.mutate({
        id: draggingId,
        status: columnKey as "todo" | "in_progress" | "review" | "done",
      });
    }
    setDraggingId(null);
    setDragOverColumn(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!allTasks?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
        <p className="text-base font-medium text-gray-700">当前筛选条件下没有任务</p>
        <button
          onClick={onCreateTask}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          新建任务
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid flex-1 grid-cols-4 gap-4 overflow-hidden">
        {columns.map((column) => {
          const tasks = allTasks.filter((task) => task.status === column.key);
          const isDragOver = dragOverColumn === column.key;

          return (
            <div
              key={column.key}
              className={`flex flex-col rounded-xl border transition-all duration-200 ${
                isDragOver ? "border-2 bg-gray-100" : "border-gray-200 bg-gray-50"
              }`}
              style={isDragOver ? { borderColor: column.color } : undefined}
              onDragOver={(event) => handleDragOver(event, column.key)}
              onDrop={(event) => handleDrop(event, column.key)}
            >
              <div className="flex items-center justify-between px-3 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: column.color }} />
                  <span className="text-sm font-semibold text-gray-700">{column.label}</span>
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-400">
                  {tasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
                {tasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
                    当前没有任务
                  </div>
                ) : (
                  tasks.map((task) => {
                    const priorityMeta =
                      TASK_PRIORITY_META[task.priority] ?? TASK_PRIORITY_META.medium;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        onClick={() => onEditTask(task)}
                        className={`cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md active:cursor-grabbing ${
                          draggingId === task.id ? "scale-95 opacity-40" : ""
                        }`}
                      >
                        <p className="mb-2 line-clamp-2 text-sm font-semibold text-gray-800">
                          {task.projectName}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              color: priorityMeta.color,
                              background: `${priorityMeta.color}18`,
                            }}
                          >
                            {priorityMeta.label}
                          </span>

                          {task.projectCode ? (
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                              {task.projectCode}
                            </span>
                          ) : null}

                          {task.projectType ? (
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                              {task.projectType}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                          <p>{task.assigneeName || "未分配负责人"}</p>
                          <p>{task.plannedEndDate ? `截止 ${task.plannedEndDate}` : "未设置截止日期"}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
