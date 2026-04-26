import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { TASK_PRIORITY_META, TASK_STATUS_META } from "@/lib/task-meta";
import type { TaskListItem } from "@/types/task";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const { data: allTasks, isLoading, isFetching } = trpc.task.list.useQuery({
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
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [activeMobileColumn, setActiveMobileColumn] = useState<(typeof columns)[number]["key"]>("todo");

  useEffect(() => {
    if (!allTasks?.length) return;
    const currentColumnHasTasks = allTasks.some((task) => task.status === activeMobileColumn);
    if (!currentColumnHasTasks) {
      const nextColumn = columns.find((column) =>
        allTasks.some((task) => task.status === column.key),
      );
      if (nextColumn) {
        setActiveMobileColumn(nextColumn.key);
      }
    }
  }, [activeMobileColumn, allTasks]);

  const taskCountMap = useMemo(() => {
    return new Map(
      columns.map((column) => [
        column.key,
        allTasks?.filter((task) => task.status === column.key).length ?? 0,
      ]),
    );
  }, [allTasks]);

  const changeTaskStatus = async (
    taskId: number,
    status: "todo" | "in_progress" | "review" | "done",
  ) => {
    setUpdatingTaskId(taskId);
    try {
      await updateStatus.mutateAsync({ id: taskId, status });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDragStart = (taskId: number) => {
    setDraggingId(taskId);
  };

  const handleDragOver = (event: React.DragEvent, columnKey: string) => {
    event.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDrop = async (event: React.DragEvent, columnKey: string) => {
    event.preventDefault();
    if (draggingId) {
      await changeTaskStatus(
        draggingId,
        columnKey as "todo" | "in_progress" | "review" | "done",
      );
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

  const renderTaskCard = (task: TaskListItem) => {
    const priorityMeta = TASK_PRIORITY_META[task.priority] ?? TASK_PRIORITY_META.medium;
    const isUpdating = updatingTaskId === task.id;

    return (
      <div
        key={task.id}
        draggable={!isMobile}
        onDragStart={() => handleDragStart(task.id)}
        onClick={() => onEditTask(task)}
        className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:shadow-md ${
          isMobile ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        } ${draggingId === task.id ? "scale-95 opacity-40" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-sm font-semibold text-gray-800">{task.projectName}</p>
          {isUpdating ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-gray-400" /> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
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

        {isMobile ? (
          <div
            className="mt-3 border-t border-gray-100 pt-3"
            onClick={(event) => event.stopPropagation()}
          >
            <label className="mb-1 block text-[11px] font-medium text-gray-500">快速移动到</label>
            <select
              value={task.status}
              disabled={isUpdating}
              onChange={(event) =>
                void changeTaskStatus(
                  task.id,
                  event.target.value as "todo" | "in_progress" | "review" | "done",
                )
              }
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-blue-500"
            >
              {columns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          {isMobile ? "手机端支持快速切换状态，不再依赖拖拽。" : "可直接拖拽任务卡片调整状态。"}
        </div>
        {isFetching ? (
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在同步任务...
          </div>
        ) : null}
      </div>

      {isMobile ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {columns.map((column) => {
              const isActive = activeMobileColumn === column.key;
              return (
                <button
                  key={column.key}
                  onClick={() => setActiveMobileColumn(column.key)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    isActive ? "border-transparent text-white" : "border-gray-200 bg-gray-50 text-gray-700"
                  }`}
                  style={isActive ? { background: column.color } : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{column.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-white text-gray-500"
                      }`}
                    >
                      {taskCountMap.get(column.key) ?? 0}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {allTasks
              .filter((task) => task.status === activeMobileColumn)
              .map((task) => renderTaskCard(task))}
          </div>
        </div>
      ) : (
        <div className="grid flex-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {columns.map((column) => {
            const tasks = allTasks.filter((task) => task.status === column.key);
            const isDragOver = dragOverColumn === column.key;

            return (
              <div
                key={column.key}
                className={`flex min-h-[240px] flex-col rounded-xl border transition-all duration-200 ${
                  isDragOver ? "border-2 bg-gray-100" : "border-gray-200 bg-gray-50"
                }`}
                style={isDragOver ? { borderColor: column.color } : undefined}
                onDragOver={(event) => handleDragOver(event, column.key)}
                onDrop={(event) => void handleDrop(event, column.key)}
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
                    tasks.map((task) => renderTaskCard(task))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
