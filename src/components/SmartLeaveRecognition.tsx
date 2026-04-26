import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Plus,
  Save,
  ScanSearch,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { loadManagerWorkspaceSettings } from "@/lib/app-settings";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addDaysToDate, diffDaysInclusive, leaveTypeLabelMap } from "@/pages/attendance/helpers";

type RecognizedLeave = {
  employeeName: string;
  type: "sick" | "annual" | "personal" | "marriage" | "maternity" | "other";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  approved: boolean;
};

type SmartLeaveRecognitionProps = {
  isOpen: boolean;
  onClose: () => void;
  userList?: { id: number; name: string | null }[];
  onSaved?: (savedLeaves: RecognizedLeave[]) => void;
};

const leaveTypeOptions = Object.entries(leaveTypeLabelMap) as Array<
  [RecognizedLeave["type"], string]
>;

function createEmptyLeave(): RecognizedLeave {
  return {
    employeeName: "",
    type: "other",
    startDate: "",
    endDate: "",
    days: 1,
    reason: "",
    approved: true,
  };
}

function compressImage(file: File, maxWidth = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const maxHeight = 6000;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png").split(",")[1] ?? "");
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SmartLeaveRecognition({
  isOpen,
  onClose,
  userList = [],
  onSaved,
}: SmartLeaveRecognitionProps) {
  const utils = trpc.useUtils();
  const recognizeMutation = trpc.ai.recognizeLeave.useMutation();
  const recognizeTextMutation = trpc.ai.recognizeLeaveText.useMutation();
  const createLeaveMutation = trpc.attendance.create.useMutation();

  const [mode, setMode] = useState<"image" | "text">("image");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [textInput, setTextInput] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [highQuality, setHighQuality] = useState(false);
  const [leaves, setLeaves] = useState<RecognizedLeave[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const settings = loadManagerWorkspaceSettings();
    setHighQuality(settings.recognitionHighQuality);
  }, []);

  const resetState = useCallback(() => {
    setMode("image");
    setImagePreview(null);
    setImageBase64("");
    setTextInput("");
    setRawFile(null);
    setLeaves([]);
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

  const handleImage = useCallback(
    async (file: File, preferHighQuality = highQuality) => {
      setMode("image");
      setError("");
      setSaveError("");
      setLeaves([]);
      setRawText("");
      setTextInput("");
      setRawFile(file);

      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target?.result as string);
      reader.readAsDataURL(file);

      try {
        const base64 =
          preferHighQuality && file.size < 4 * 1024 * 1024
            ? await fileToBase64(file)
            : await compressImage(file);
        setImageBase64(base64);
      } catch {
        setError("截图处理失败，请重新上传");
      }
    },
    [highQuality],
  );

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

  const matchUserId = (name: string) => {
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

  const getMatchStatus = (name: string) => {
    if (!name.trim()) return "empty";
    return matchUserId(name) ? "matched" : "unmatched";
  };

  const handleRecognize = async () => {
    if (mode === "image" && !imageBase64) {
      setError("请先上传聊天截图");
      return;
    }

    if (mode === "text" && !textInput.trim()) {
      setError("请先输入请假描述");
      return;
    }

    setError("");
    try {
      const result =
        mode === "text"
          ? await recognizeTextMutation.mutateAsync({
              text: textInput.trim(),
            })
          : await recognizeMutation.mutateAsync({
              imageBase64,
            });

      setRawText(result.raw);

      if (!result.leaves.length) {
        setError(
          mode === "text"
            ? "未识别到请假记录，请补充更完整的文字描述"
            : "未识别到请假记录，请更换更清晰的聊天截图",
        );
        return;
      }

      setLeaves(
        result.leaves.map((leave) => ({
          employeeName: leave.employeeName || "",
          type: leave.type || "other",
          startDate: leave.startDate || "",
          endDate: leave.endDate || "",
          days: leave.days || 1,
          reason: leave.reason || "",
          approved: leave.approved ?? true,
        })),
      );
    } catch (mutationError: any) {
      setError(mutationError.message || "请假识别失败");
    }
  };

  const updateLeave = <K extends keyof RecognizedLeave>(
    index: number,
    field: K,
    value: RecognizedLeave[K],
  ) => {
    setLeaves((current) =>
      current.map((leave, currentIndex) => {
        if (currentIndex !== index) return leave;

        const next = { ...leave, [field]: value } as RecognizedLeave;

        if (field === "startDate" && next.startDate && next.days) {
          next.endDate = addDaysToDate(next.startDate, next.days - 1);
        }
        if (field === "endDate" && next.startDate && next.endDate) {
          next.days = diffDaysInclusive(next.startDate, next.endDate);
        }
        if (field === "days" && next.startDate && next.days) {
          next.endDate = addDaysToDate(next.startDate, next.days - 1);
        }

        return next;
      }),
    );
  };

  const handleSaveAll = async () => {
    setSaveError("");

    const validLeaves = leaves.filter((leave) => leave.employeeName.trim());
    if (!validLeaves.length) {
      setSaveError("请至少保留一条包含员工姓名的请假记录");
      return;
    }

    const missingDates = validLeaves.filter((leave) => !leave.startDate || !leave.endDate);
    if (missingDates.length) {
      setSaveError(
        `以下记录缺少开始或结束日期：\n${missingDates
          .map((leave) => `- ${leave.employeeName || "未命名员工"}`)
          .join("\n")}`,
      );
      return;
    }

    const invalidRanges = validLeaves.filter((leave) => leave.startDate > leave.endDate);
    if (invalidRanges.length) {
      setSaveError(
        `以下记录的结束日期早于开始日期：\n${invalidRanges
          .map((leave) => `- ${leave.employeeName || "未命名员工"}`)
          .join("\n")}`,
      );
      return;
    }

    const unmatched = validLeaves.filter((leave) => !matchUserId(leave.employeeName));
    if (unmatched.length) {
      setSaveError(
        `以下员工未匹配到系统员工：\n${unmatched
          .map((leave) => `- ${leave.employeeName}`)
          .join("\n")}`,
      );
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(
        validLeaves.map((leave) =>
          createLeaveMutation.mutateAsync({
            userId: matchUserId(leave.employeeName)!,
            type: leave.type,
            startDate: leave.startDate,
            endDate: leave.endDate,
            days: leave.days,
            reason: leave.reason.trim() || undefined,
            status: leave.approved ? "approved" : "pending",
          }),
        ),
      );

      await Promise.all([utils.attendance.list.invalidate(), utils.attendance.stats.invalidate()]);

      onSaved?.(validLeaves);
      onClose();
    } catch (mutationError: any) {
      setSaveError(mutationError.message || "批量保存请假记录失败");
    } finally {
      setIsSaving(false);
    }
  };

  const isRecognizing = recognizeMutation.isPending || recognizeTextMutation.isPending;
  const validCount = leaves.filter((leave) => leave.employeeName.trim()).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-[calc(100%-0.5rem)] gap-0 overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:gap-4 sm:rounded-lg sm:p-6">
        <DialogHeader className="border-b border-gray-100 pb-4 sm:border-b-0 sm:pb-0">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-blue-600" />
            <DialogTitle>智能识别请假记录</DialogTitle>
          </div>
          <DialogDescription>
            支持聊天截图和文字描述两种方式，识别后的请假记录可直接修正并入库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4 sm:py-0">
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setMode("image")}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${
                mode === "image" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
              }`}
            >
              截图识别
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${
                mode === "text" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
              }`}
            >
              文字描述
            </button>
          </div>

          {mode === "text" ? (
            <div className="space-y-4">
              <textarea
                rows={7}
                value={textInput}
                onChange={(event) => {
                  setTextInput(event.target.value);
                  setError("");
                  setSaveError("");
                  setLeaves([]);
                  setRawText("");
                  setImagePreview(null);
                  setImageBase64("");
                  setRawFile(null);
                }}
                placeholder="例如：闫康佳4月2日开始请3天年假。"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={handleRecognize}
                disabled={isRecognizing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {isRecognizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                {isRecognizing ? "识别中..." : "开始识别"}
              </button>
            </div>
          ) : !imagePreview ? (
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
              className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center hover:border-blue-400 hover:bg-blue-50/40 sm:px-6 sm:py-14"
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
              <p className="mt-3 text-sm font-medium text-gray-700">点击上传或拖拽聊天截图到此处</p>
              <p className="mt-1 text-xs text-gray-500">支持直接粘贴截图（Ctrl+V）</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                <img
                  src={imagePreview}
                  alt="leave-preview"
                  className="mx-auto max-h-[360px] w-full object-contain"
                />
                <button
                  onClick={resetState}
                  className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="flex items-start gap-2 text-xs leading-5 text-gray-600">
                <input
                  type="checkbox"
                  checked={highQuality}
                  onChange={(event) => {
                    const nextValue = event.target.checked;
                    setHighQuality(nextValue);
                    if (rawFile) {
                      void handleImage(rawFile, nextValue);
                    }
                  }}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                高清模式不压缩原图，适合长截图，建议文件小于 4MB。
              </label>

              <button
                onClick={handleRecognize}
                disabled={isRecognizing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {isRecognizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                {isRecognizing ? "识别中..." : "开始识别"}
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
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                {rawText}
              </pre>
            </div>
          ) : null}

          {leaves.length ? (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">识别结果预览</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    无法匹配系统员工的记录不能直接保存，需要先手动指定员工。
                  </p>
                </div>
                <button
                  onClick={() => setLeaves((current) => [...current, createEmptyLeave()])}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  手动添加
                </button>
              </div>

              <div className="space-y-4">
                {leaves.map((leave, index) => {
                  const matchStatus = getMatchStatus(leave.employeeName);

                  return (
                    <div
                      key={`${leave.employeeName}-${leave.startDate}-${index}`}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">记录 {index + 1}</p>
                        <button
                          onClick={() =>
                            setLeaves((current) =>
                              current.filter((_, currentIndex) => currentIndex !== index),
                            )
                          }
                          className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            员工姓名
                            {matchStatus === "matched" ? (
                              <span className="ml-2 text-[10px] text-emerald-600">已匹配</span>
                            ) : null}
                            {matchStatus === "unmatched" ? (
                              <span className="ml-2 text-[10px] text-red-500">未匹配</span>
                            ) : null}
                          </label>
                          <input
                            type="text"
                            value={leave.employeeName}
                            onChange={(event) =>
                              updateLeave(index, "employeeName", event.target.value)
                            }
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                              matchStatus === "unmatched"
                                ? "border-red-300 bg-red-50"
                                : "border-gray-300"
                            }`}
                          />
                          {matchStatus === "unmatched" && userList.length ? (
                            <select
                              value=""
                              onChange={(event) => {
                                const matched = userList.find(
                                  (user) => String(user.id) === event.target.value,
                                );
                                if (matched?.name) {
                                  updateLeave(index, "employeeName", matched.name);
                                }
                              }}
                              className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 focus:outline-none"
                            >
                              <option value="">手动指定系统员工...</option>
                              {userList.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name || `用户-${user.id}`}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            请假类型
                          </label>
                          <select
                            value={leave.type}
                            onChange={(event) =>
                              updateLeave(
                                index,
                                "type",
                                event.target.value as RecognizedLeave["type"],
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            {leaveTypeOptions.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            开始日期
                          </label>
                          <input
                            type="date"
                            value={leave.startDate}
                            onChange={(event) =>
                              updateLeave(index, "startDate", event.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            结束日期
                          </label>
                          <input
                            type="date"
                            value={leave.endDate}
                            onChange={(event) => updateLeave(index, "endDate", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            请假天数
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={leave.days}
                            onChange={(event) =>
                              updateLeave(index, "days", Number(event.target.value) || 1)
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            记录状态
                          </label>
                          <select
                            value={leave.approved ? "approved" : "pending"}
                            onChange={(event) =>
                              updateLeave(index, "approved", event.target.value === "approved")
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="approved">已确认</option>
                            <option value="pending">待确认</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-500">
                            请假原因
                          </label>
                          <input
                            type="text"
                            value={leave.reason}
                            onChange={(event) => updateLeave(index, "reason", event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <div className="flex items-start gap-2 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-gray-100 pt-4 sm:border-t-0 sm:pt-0">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            取消
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || !leaves.length}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "保存中..." : `保存 ${validCount} 条记录`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
