import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Key,
  Loader2,
  Plus,
  Save,
  ScanSearch,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/task-meta";
import { loadKimiApiKey, saveKimiApiKey } from "@/lib/app-settings";
import { compressImage } from "@/lib/image";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RecognizedTask = {
  projectName: string;
  assigneeName: string;
  plannedEndDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "review" | "done";
  remark: string;
};

type SmartTaskRecognitionProps = {
  isOpen: boolean;
  onClose: () => void;
  userList?: { id: number; name: string | null }[];
};

function createEmptyTask(): RecognizedTask {
  return {
    projectName: "",
    assigneeName: "",
    plannedEndDate: "",
    priority: "medium",
    status: "todo",
    remark: "",
  };
}

export default function SmartTaskRecognition({
  isOpen,
  onClose,
  userList = [],
}: SmartTaskRecognitionProps) {
  const utils = trpc.useUtils();
  const recognizeMutation = trpc.ai.recognizeTask.useMutation();
  const createTaskMutation = trpc.task.create.useMutation();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tasks, setTasks] = useState<RecognizedTask[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadKimiApiKey();
    if (saved) {
      setApiKey(saved);
    }
  }, []);

  const resetState = useCallback(() => {
    setImagePreview(null);
    setImageBase64("");
    setTasks([]);
    setRawText("");
    setError("");
    setSaveError("");
    setIsSaving(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleImage = useCallback(async (file: File) => {
    setError("");
    setSaveError("");
    setTasks([]);
    setRawText("");

    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const dataUrl = await compressImage(file, 2200, 2200, 0.92);
      setImageBase64(dataUrl.split(",")[1] ?? "");
    } catch {
      setError("截图处理失败，请重新上传。");
    }
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) {
          void handleImage(file);
        }
        break;
      }
    },
    [handleImage],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, isOpen]);

  const matchAssigneeId = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return undefined;

    const exact = userList.find((user) => user.name?.trim() === trimmed);
    if (exact) return exact.id;

    const fuzzy = userList.find((user) => {
      const userName = user.name?.trim();
      return userName ? userName.includes(trimmed) || trimmed.includes(userName) : false;
    });
    return fuzzy?.id;
  };

  const handleRecognize = async () => {
    if (!imageBase64) {
      setError("请先上传任务截图。");
      return;
    }
    if (!apiKey.trim()) {
      setShowKeyInput(true);
      setError("请先配置 OCR API Key。");
      return;
    }

    setError("");
    try {
      const result = await recognizeMutation.mutateAsync({
        imageBase64,
        apiKey: apiKey.trim(),
      });

      setRawText(result.raw);

      if (!result.tasks.length) {
        setError("未识别到任务信息，请更换更清晰的截图。");
        return;
      }

      setTasks(
        result.tasks.map((task) => ({
          projectName: task.projectName || "",
          assigneeName: task.assigneeName || "",
          plannedEndDate: task.plannedEndDate || "",
          priority: task.priority || "medium",
          status: task.status || "todo",
          remark: task.remark || "",
        })),
      );
    } catch (mutationError: any) {
      setError(mutationError.message || "任务识别失败。");
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) return;
    saveKimiApiKey(apiKey);
    setShowKeyInput(false);
    setError("");
  };

  const handleSaveAll = async () => {
    setSaveError("");
    const validTasks = tasks.filter((task) => task.projectName.trim());

    if (!validTasks.length) {
      setSaveError("请至少保留一条包含任务名称的记录。");
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(
        validTasks.map((task) =>
          createTaskMutation.mutateAsync({
            projectName: task.projectName.trim(),
            assigneeId: matchAssigneeId(task.assigneeName),
            priority: task.priority,
            status: task.status,
            plannedEndDate: task.plannedEndDate || undefined,
            remark: task.remark.trim() || undefined,
          }),
        ),
      );

      await Promise.all([
        utils.task.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);

      onClose();
    } catch (mutationError: any) {
      setSaveError(mutationError.message || "批量保存任务失败。");
    } finally {
      setIsSaving(false);
    }
  };

  const updateTaskField = <K extends keyof RecognizedTask>(
    index: number,
    field: K,
    value: RecognizedTask[K],
  ) => {
    setTasks((current) =>
      current.map((task, currentIndex) =>
        currentIndex === index ? { ...task, [field]: value } : task,
      ),
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-blue-600" />
            <DialogTitle>智能识别任务</DialogTitle>
          </div>
          <DialogDescription>
            上传任务清单、会议纪要或表格截图，识别结果可直接修正后保存。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">OCR API Key</p>
                <p className="mt-1 text-xs text-gray-500">
                  当前使用 Kimi 视觉识别，保存后会复用本机缓存。
                </p>
              </div>
              {!showKeyInput && apiKey ? (
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  修改
                </button>
              ) : null}
            </div>

            {showKeyInput || !apiKey ? (
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <div className="relative w-full">
                  <Key className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-..."
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button
                  onClick={handleSaveApiKey}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-700">已配置：sk-****{apiKey.slice(-4)}</p>
            )}
          </div>

          {!imagePreview ? (
            <div
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file?.type.startsWith("image/")) {
                  void handleImage(file);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center hover:border-blue-400 hover:bg-blue-50/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImage(file);
                  }
                }}
                className="hidden"
              />
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <p className="mt-3 text-sm font-medium text-gray-700">点击上传或拖拽截图到此处</p>
              <p className="mt-1 text-xs text-gray-500">支持直接粘贴截图（Ctrl+V）</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                <img
                  src={imagePreview}
                  alt="task-preview"
                  className="mx-auto max-h-[360px] object-contain"
                />
                <button
                  onClick={resetState}
                  className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleRecognize}
                disabled={recognizeMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {recognizeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                {recognizeMutation.isPending ? "识别中..." : "开始识别"}
              </button>
            </div>
          )}

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {rawText ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">识别原文</h3>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                {rawText}
              </pre>
            </div>
          ) : null}

          {tasks.length ? (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">识别结果预览</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    负责人无法匹配到系统员工时，会按未指派任务保存。
                  </p>
                </div>
                <button
                  onClick={() => setTasks((current) => [...current, createEmptyTask()])}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  手动添加
                </button>
              </div>

              <div className="space-y-4">
                {tasks.map((task, index) => {
                  const matchedAssignee = matchAssigneeId(task.assigneeName);
                  return (
                    <div
                      key={`${task.projectName}-${index}`}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">记录 {index + 1}</p>
                        <button
                          onClick={() =>
                            setTasks((current) =>
                              current.filter((_, currentIndex) => currentIndex !== index),
                            )
                          }
                          className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            任务名称
                          </label>
                          <input
                            type="text"
                            value={task.projectName}
                            onChange={(event) =>
                              updateTaskField(index, "projectName", event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            负责人
                          </label>
                          <input
                            type="text"
                            value={task.assigneeName}
                            onChange={(event) =>
                              updateTaskField(index, "assigneeName", event.target.value)
                            }
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                              task.assigneeName.trim() && !matchedAssignee
                                ? "border-amber-300 bg-amber-50"
                                : "border-gray-300"
                            }`}
                          />
                          {task.assigneeName.trim() && !matchedAssignee ? (
                            <p className="mt-1 text-xs text-amber-700">未匹配到系统员工，将按未指派保存。</p>
                          ) : null}
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            截止日期
                          </label>
                          <input
                            type="date"
                            value={task.plannedEndDate}
                            onChange={(event) =>
                              updateTaskField(index, "plannedEndDate", event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            优先级
                          </label>
                          <select
                            value={task.priority}
                            onChange={(event) =>
                              updateTaskField(
                                index,
                                "priority",
                                event.target.value as RecognizedTask["priority"],
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            {TASK_PRIORITY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            状态
                          </label>
                          <select
                            value={task.status}
                            onChange={(event) =>
                              updateTaskField(
                                index,
                                "status",
                                event.target.value as RecognizedTask["status"],
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            {TASK_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            备注
                          </label>
                          <textarea
                            rows={3}
                            value={task.remark}
                            onChange={(event) =>
                              updateTaskField(index, "remark", event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {saveError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || !tasks.length}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "保存中..." : `保存 ${tasks.filter((task) => task.projectName.trim()).length} 条记录`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
