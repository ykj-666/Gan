import { useCallback, useRef, useState } from "react";
import { Loader2, Plus, Save, ScanSearch, Trash2, Upload, X } from "lucide-react";
import { compressImage } from "@/lib/image";
import { trpc } from "@/providers/trpc";
import { StatCard } from "./StatCard";
import { TripFormFields, TripMetrics } from "./BusinessTripForm";
import {
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
}: {
  cycleMonth: string;
  onCycleMonthChange: (value: string) => void;
  onSaved: () => void;
  users: UserOption[];
}) {
  const utils = trpc.useUtils();
  const recognizeMutation = trpc.ai.recognizeBusinessTrip.useMutation();
  const batchCreateMutation = trpc.businessTrip.batchCreate.useMutation();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [trips, setTrips] = useState<TripDraft[]>([]);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleImage = useCallback(async (file: File) => {
    setError("");
    setSaveError("");
    setTrips([]);
    setRawText("");

    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const dataUrl = await compressImage(file, 2200, 2200, 0.92);
      setImageBase64(dataUrl.split(",")[1]);
    } catch {
      setError("截图处理失败，请重试");
    }
  }, []);

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
    if (!imageBase64) {
      setError("请先上传截图");
      return;
    }
    setError("");
    try {
      const result = await recognizeMutation.mutateAsync({
        imageBase64,
      });
      setRawText(result.raw);
      if (!result.trips.length) {
        setError("未识别到出差信息，请更换清晰的派遣函或现场证明截图");
        return;
      }
      setTrips(
        result.trips.map((trip: RecognizedTrip) => {
          const matchedUser = matchUserByName(trip.employeeName, users);
          return buildTripDraft(
            {
              ...trip,
              userId: matchedUser?.id ?? "",
              employeeName: matchedUser?.name ?? trip.employeeName,
              department: matchedUser?.department ?? trip.department,
            },
            cycleMonth,
          );
        }),
      );
    } catch (mutationError: any) {
      setError(mutationError.message || "截图识别失败");
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
      await batchCreateMutation.mutateAsync(trips.map(toTripPayload));
      await Promise.all([
        utils.businessTrip.list.invalidate(),
        utils.businessTrip.departments.invalidate(),
      ]);
      setTrips([]);
      setImagePreview(null);
      setImageBase64("");
      setRawText("");
      onSaved();
    } catch (mutationError: any) {
      setSaveError(mutationError.message || "批量保存失败");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">上传识别</h3>
              <p className="mt-1 text-sm text-gray-500">
                上传派遣函或现场证明截图，识别结果可直接编辑后入库。
              </p>
            </div>
            <button
              onClick={() =>
                setTrips((current) => [...current, buildTripDraft({}, cycleMonth)])
              }
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              手动添加
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">考勤周期</label>
              <input
                type="month"
                value={cycleMonth}
                onChange={(event) => onCycleMonthChange(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-xs text-gray-500">
                {getCycleRangeFromMonth(cycleMonth).label}
              </p>
            </div>

          </div>

          <div className="mt-5">
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
                    className="mx-auto max-h-[360px] object-contain"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageBase64("");
                      setTrips([]);
                      setRawText("");
                    }}
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
                  >
                    <X className="h-4 w-4" />
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
          </div>
        </div>

        {rawText ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">识别原文</h3>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              {rawText}
            </pre>
          </div>
        ) : null}

        {trips.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">识别结果预览</h3>
                <p className="mt-1 text-sm text-gray-500">字段可编辑，保存前会按规则校验。</p>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={batchCreateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">记录 {index + 1}</p>
                    <button
                      onClick={() =>
                        setTrips((current) => current.filter((_, i) => i !== index))
                      }
                      className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <TripFormFields
                    trip={trip}
                    users={users}
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
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-semibold text-gray-900">识别说明</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>固定考勤周期为上月 25 日至当月 24 日。</li>
            <li>自动提取姓名、部门、项目编号、派遣起止日和出差地点。</li>
            <li>长期出差字段和补贴天数会自动计算，支持手动修正。</li>
            <li>缺勤天数大于 0 必须填写原因，补贴天数超过周期必须填写备注。</li>
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <StatCard label="待保存记录" value={trips.length} />
          <StatCard label="已上传截图" value={imagePreview ? 1 : 0} />
        </div>
      </div>
    </div>
  );
}
