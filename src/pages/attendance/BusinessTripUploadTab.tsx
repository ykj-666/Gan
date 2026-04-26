import { useCallback, useRef, useState } from "react";
import { Loader2, Plus, Save, ScanSearch, Trash2, Upload, X } from "lucide-react";
import { compressImage } from "@/lib/image";
import { trpc } from "@/providers/trpc";
import { StatCard } from "./StatCard";
import { TripFormFields, TripMetrics } from "./BusinessTripForm";
import {
  addDaysToDate,
  buildTripDraft,
  matchUserByName,
  rebaseTripToCycle,
  refreshTripTotals,
  toTripPayload,
  type RecognizedTrip,
  type TripDraft,
  type UserOption,
  validateTrip,
} from "./helpers";
import { getCycleRangeFromMonth } from "@contracts/business-trip";

export function BusinessTripUploadTab({
  cycleMonth,
  onCycleMonthChange,
  onSaved,
  users,
  tasks,
}: {
  cycleMonth: string;
  onCycleMonthChange: (value: string) => void;
  onSaved: () => void;
  users: UserOption[];
  tasks: Array<{ projectName: string; projectCode: string | null }>;
}) {
  const utils = trpc.useUtils();
  const recognizeMutation = trpc.ai.recognizeBusinessTrip.useMutation();
  const recognizeTextMutation = trpc.ai.recognizeBusinessTripText.useMutation();
  const batchCreateMutation = trpc.businessTrip.batchCreate.useMutation();

  const [mode, setMode] = useState<"image" | "text">("image");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [textInput, setTextInput] = useState("");
  const [trips, setTrips] = useState<TripDraft[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchTask = useCallback(
    (projectCode: string, projectName: string) => {
      const normalizedCode = projectCode.trim();
      if (normalizedCode) {
        const matchedByCode = tasks.find(
          (task) => task.projectCode?.trim() && task.projectCode.trim() === normalizedCode,
        );
        if (matchedByCode) return matchedByCode;
      }

      const normalizedName = projectName.trim().toLowerCase();
      if (!normalizedName) return undefined;

      return tasks.find((task) => {
        const taskName = task.projectName.trim().toLowerCase();
        return (
          taskName === normalizedName ||
          taskName.includes(normalizedName) ||
          normalizedName.includes(taskName)
        );
      });
    },
    [tasks],
  );

  const extractTripDaysFromText = useCallback((text: string) => {
    const match = text.match(/(\d+)\s*天/);
    if (!match) return null;
    const days = Number(match[1]);
    return Number.isFinite(days) && days > 0 ? days : null;
  }, []);

  const hasExplicitDateInText = useCallback((text: string) => {
    return /(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}[日号]?)|(\d{1,2}月\d{1,2}[日号]?)/.test(text);
  }, []);

  const normalizeTextRecognizedTrip = useCallback(
    (trip: RecognizedTrip, sourceText: string) => {
      const days = extractTripDaysFromText(sourceText);
      const explicitDateProvided = hasExplicitDateInText(sourceText);
      const cycle = getCycleRangeFromMonth(cycleMonth);
      const nextTrip = { ...trip };

      if (days && !explicitDateProvided) {
        nextTrip.dispatchStart = cycle.cycleStart;
        nextTrip.dispatchEnd = addDaysToDate(cycle.cycleStart, days - 1);
        return nextTrip;
      }

      if (days && nextTrip.dispatchStart) {
        nextTrip.dispatchEnd = addDaysToDate(nextTrip.dispatchStart, days - 1);
      }

      return nextTrip;
    },
    [cycleMonth, extractTripDaysFromText, hasExplicitDateInText],
  );

  const resetRecognizedState = useCallback(() => {
    setTrips([]);
    setRawText("");
    setError("");
    setSaveError("");
  }, []);

  const saveTripsDirectly = useCallback(
    async (drafts: TripDraft[]) => {
      await batchCreateMutation.mutateAsync(drafts.map(toTripPayload));
      await Promise.all([
        utils.businessTrip.list.invalidate(),
        utils.businessTrip.departments.invalidate(),
      ]);
      setTrips([]);
      setImagePreview(null);
      setImageBase64("");
      setTextInput("");
      setRawText("");
      onSaved();
    },
    [batchCreateMutation, onSaved, utils],
  );

  const handleImage = useCallback(async (file: File) => {
    setMode("image");
    resetRecognizedState();
    setTextInput("");

    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const dataUrl = await compressImage(file, 2200, 2200, 0.92);
      setImageBase64(dataUrl.split(",")[1]);
    } catch {
      setError("截图处理失败，请重试");
    }
  }, [resetRecognizedState]);

  const updateTrip = <K extends keyof TripDraft>(
    index: number,
    field: K,
    value: TripDraft[K],
  ) => {
    setTrips((current) =>
      current.map((trip, currentIndex) => {
        if (currentIndex !== index) return trip;
        const next = { ...trip, [field]: value } as TripDraft;
        if (field === "cycleMonth") return rebaseTripToCycle(next, String(value));
        if (field === "dispatchStart" || field === "dispatchEnd") {
          return rebaseTripToCycle(next, next.cycleMonth);
        }
        if (
          field === "workDays" ||
          field === "officeDays" ||
          field === "tripDays" ||
          field === "tempDays" ||
          field === "subsidyDays"
        ) {
          return refreshTripTotals(next);
        }
        return next;
      }),
    );
  };

  const handleRecognize = async () => {
    if (mode === "image" && !imageBase64) {
      setError("请先上传截图");
      return;
    }

    if (mode === "text" && !textInput.trim()) {
      setError("请先输入出差描述");
      return;
    }

    setError("");
    setSaveError("");

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
      if (!result.trips.length) {
        setError(
          mode === "text"
            ? "未识别到出差信息，请补充更完整的文字描述"
            : "未识别到出差信息，请更换清晰的派遣函或现场证明截图",
        );
        return;
      }

      const preparedTrips = result.trips.map((rawTrip: RecognizedTrip) => {
        const trip = mode === "text" ? normalizeTextRecognizedTrip(rawTrip, textInput) : rawTrip;
        const matchedUser = matchUserByName(trip.employeeName, users);
        const matchedTask = matchTask(trip.projectCode, trip.projectName);
        return buildTripDraft(
          {
            ...trip,
            userId: matchedUser?.id ?? "",
            employeeName: matchedUser?.name ?? trip.employeeName,
            department: matchedUser?.department ?? trip.department,
            projectName: matchedTask?.projectName ?? trip.projectName ?? "",
            projectCode: matchedTask?.projectCode ?? trip.projectCode,
          },
          cycleMonth,
        );
      });

      const invalid = preparedTrips
        .map((trip, index) => ({ index, message: validateTrip(trip) }))
        .find((item) => item.message);

      if (invalid?.message) {
        setTrips(preparedTrips);
        setSaveError(
          `第 ${invalid.index + 1} 条记录无法自动保存：${invalid.message}。已保留到编辑区，可直接修改后保存。`,
        );
        return;
      }

      await saveTripsDirectly(preparedTrips);
    } catch (mutationError: any) {
      setError(mutationError.message || "出差识别失败");
    }
  };

  const handleSaveAll = async () => {
    setSaveError("");

    if (!trips.length) {
      setSaveError("请先识别或手动添加出差记录");
      return;
    }

    const invalid = trips
      .map((trip, index) => ({ index, message: validateTrip(trip) }))
      .find((item) => item.message);

    if (invalid?.message) {
      setSaveError(`第 ${invalid.index + 1} 条记录有误：${invalid.message}`);
      return;
    }

    try {
      await saveTripsDirectly(trips);
    } catch (mutationError: any) {
      setSaveError(mutationError.message || "批量保存失败");
    }
  };

  const isRecognizing = recognizeMutation.isPending || recognizeTextMutation.isPending;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.86fr)]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">上传识别</h3>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                上传派遣函或现场证明截图，也支持直接输入自然语言描述。
              </p>
            </div>
            <button
              onClick={() => setTrips((current) => [...current, buildTripDraft({}, cycleMonth)])}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              手动添加
            </button>
          </div>

          <div className="mt-5 flex rounded-xl border border-gray-200 bg-gray-50 p-1">
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

          <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">考勤周期</label>
              <input
                type="month"
                value={cycleMonth}
                onChange={(event) => onCycleMonthChange(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-gray-500">
                {getCycleRangeFromMonth(cycleMonth).label}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {mode === "text" ? (
              <div className="space-y-3">
                <textarea
                  rows={7}
                  value={textInput}
                  onChange={(event) => {
                    setTextInput(event.target.value);
                    resetRecognizedState();
                    setImagePreview(null);
                    setImageBase64("");
                  }}
                  placeholder="例如：闫康佳在上海和辉光电项目出差4天，4月1日开始，地点在上海浦东。"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs leading-5 text-gray-500">
                  支持“谁在哪个项目出差几天、几号开始、在哪里”这类自然语言描述。
                </p>
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
                  {isRecognizing ? "识别中..." : "识别并保存"}
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
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImage(file);
                    }
                  }}
                />
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-700">点击上传或拖拽截图到此处</p>
                <p className="mt-1 text-xs text-gray-500">支持派遣函、现场证明、出差说明截图</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <img
                    src={imagePreview}
                    alt="trip-preview"
                    className="mx-auto max-h-[360px] w-full object-contain"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageBase64("");
                      setTextInput("");
                      resetRecognizedState();
                    }}
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

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
                  {isRecognizing ? "识别中..." : "识别并保存"}
                </button>
              </div>
            )}
          </div>
        </div>

        {rawText ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900">识别原文</h3>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
              {rawText}
            </pre>
          </div>
        ) : null}

        {trips.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">识别结果预览</h3>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  仅当字段不完整时才留在编辑区，修正后可一键保存。
                </p>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={batchCreateMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {batchCreateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存全部
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {trips.map((trip, index) => (
                <div
                  key={`${trip.employeeName}-${trip.projectCode}-${index}`}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">记录 {index + 1}</p>
                    <button
                      onClick={() => setTrips((current) => current.filter((_, i) => i !== index))}
                      className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <TripFormFields
                    trip={trip}
                    users={users}
                    tasks={tasks}
                    onChange={(field, value) => updateTrip(index, field, value)}
                  />
                  <div className="mt-4">
                    <TripMetrics trip={trip} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error || saveError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || saveError}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-base font-semibold text-gray-900">识别说明</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
            <li>固定考勤周期为上月 25 日至当月 24 日。</li>
            <li>支持截图识别和直接输入文字描述两种方式。</li>
            <li>自动提取姓名、部门、项目编号/项目名称、派遣起止日和出差地点。</li>
            <li>识别成功后会直接保存，只有字段不完整时才退回编辑区。</li>
            <li>长期出差字段和补贴天数会自动计算，支持手动修正。</li>
            <li>缺勤天数大于 0 必须填写原因，补贴天数超过周期必须填写备注。</li>
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StatCard label="待保存记录" value={trips.length} />
          <StatCard label="已上传截图" value={imagePreview ? 1 : 0} />
        </div>
      </div>
    </div>
  );
}
