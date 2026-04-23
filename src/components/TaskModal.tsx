import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { X, Save } from "lucide-react";
import type { Task } from "@db/schema";

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusOptions = [
  { value: "todo", label: "待处理" },
  { value: "in_progress", label: "进行中" },
  { value: "review", label: "审核中" },
  { value: "done", label: "已完成" },
];

const priorityOptions = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

export function TaskModal({ task, isOpen, onClose }: TaskModalProps) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [tag, setTag] = useState("");

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId?.toString() ?? "");
      setDueDate(
        task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : ""
      );
      setTag(task.tag ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
      setTag("");
    }
  }, [task, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      status: status as "todo" | "in_progress" | "review" | "done",
      priority: priority as "low" | "medium" | "high" | "urgent",
      assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
      dueDate: dueDate || undefined,
      tag: tag.trim() || undefined,
    };

    if (task) {
      updateTask.mutate({ id: task.id, ...data });
    } else {
      createTask.mutate(data);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative glass-card w-full max-w-lg mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {task ? "编辑任务" : "新建任务"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              任务标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题"
              required
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任务描述（可选）"
              rows={3}
              className="glass-input w-full px-4 py-2.5 text-sm text-gray-800 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                状态
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 cursor-pointer"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                优先级
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="glass-input w-full px-4 py-2.5 text-sm text-gray-700 cursor-pointer"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                截止日期
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="glass-input w-full px-4 py-2.5 text-sm text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                标签
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="如：前端、设计"
                className="glass-input w-full px-4 py-2.5 text-sm text-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-white/60 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createTask.isPending || updateTask.isPending}
              className="btn-jelly flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              <Save className="w-4 h-4" />
              {createTask.isPending || updateTask.isPending
                ? "保存中..."
                : task
                  ? "更新任务"
                  : "创建任务"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
