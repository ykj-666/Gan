import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import type { Task } from "@db/schema";
import { trpc } from "@/providers/trpc";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_PROJECT_TYPE_OPTIONS,
  TASK_SPECIALTY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/task-meta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskModal({ task, isOpen, onClose }: TaskModalProps) {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.user.list.useQuery();

  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectType, setProjectType] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [projectManagerId, setProjectManagerId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      void utils.task.list.invalidate();
      void utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      void utils.task.list.invalidate();
      void utils.stats.dashboard.invalidate();
      onClose();
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    setError("");

    if (task) {
      setProjectName(task.projectName);
      setProjectCode(task.projectCode ?? "");
      setProjectType(task.projectType ?? "");
      setSpecialty(task.specialty ?? "");
      setProjectManagerId(task.projectManagerId?.toString() ?? "");
      setAssigneeId(task.assigneeId?.toString() ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setPlannedStartDate(task.plannedStartDate ?? "");
      setPlannedEndDate(task.plannedEndDate ?? "");
      setEstimatedHours(task.estimatedHours?.toString() ?? "");
      setRemark(task.remark ?? "");
      return;
    }

    setProjectName("");
    setProjectCode("");
    setProjectType("");
    setSpecialty("");
    setProjectManagerId("");
    setAssigneeId("");
    setStatus("todo");
    setPriority("medium");
    setPlannedStartDate("");
    setPlannedEndDate("");
    setEstimatedHours("");
    setRemark("");
  }, [isOpen, task]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectName.trim()) {
      setError("项目名称不能为空");
      return;
    }

    if (plannedStartDate && plannedEndDate && plannedEndDate < plannedStartDate) {
      setError("截止日期不能早于开始日期");
      return;
    }

    setError("");

    const payload = {
      projectName: projectName.trim(),
      projectCode: projectCode.trim() || undefined,
      projectType: projectType || undefined,
      specialty: specialty || undefined,
      projectManagerId: projectManagerId ? Number(projectManagerId) : undefined,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      status: status as "todo" | "in_progress" | "review" | "done",
      priority: priority as "low" | "medium" | "high" | "urgent",
      plannedStartDate: plannedStartDate || undefined,
      plannedEndDate: plannedEndDate || undefined,
      estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      remark: remark.trim() || undefined,
    };

    if (task) {
      updateTask.mutate({ id: task.id, ...payload });
      return;
    }

    createTask.mutate(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "编辑任务" : "新建任务"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="输入项目名称"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">项目编号</label>
              <input
                type="text"
                value={projectCode}
                onChange={(event) => setProjectCode(event.target.value)}
                placeholder="项目编号"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">项目类型</label>
              <select
                value={projectType}
                onChange={(event) => setProjectType(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">请选择</option>
                {TASK_PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">专业</label>
              <select
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">请选择</option>
                {TASK_SPECIALTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">项目经理</label>
              <select
                value={projectManagerId}
                onChange={(event) => setProjectManagerId(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">请选择</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || `用户-${user.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">负责人</label>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">请选择</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || `用户-${user.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">状态</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">优先级</label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {TASK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">开始日期</label>
              <input
                type="date"
                value={plannedStartDate}
                onChange={(event) => setPlannedStartDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">截止日期</label>
              <input
                type="date"
                value={plannedEndDate}
                onChange={(event) => setPlannedEndDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">预计工时</label>
              <input
                type="number"
                min={0}
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                placeholder="小时"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">备注</label>
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="补充说明"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createTask.isPending || updateTask.isPending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {createTask.isPending || updateTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {createTask.isPending || updateTask.isPending
                ? "保存中..."
                : task
                  ? "保存修改"
                  : "创建任务"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
