import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addDaysToDate,
  buildLeaveDraft,
  diffDaysInclusive,
  leaveStatusLabelMap,
  leaveTypeLabelMap,
  type LeaveDraft,
} from "./helpers";

type LeaveManualDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { id: number; name: string | null }[];
  onSubmit: (draft: LeaveDraft) => Promise<void>;
  isSubmitting: boolean;
  initialDraft?: Partial<LeaveDraft>;
  title?: string;
  submitLabel?: string;
};

export function LeaveManualDialog({
  open,
  onOpenChange,
  users,
  onSubmit,
  isSubmitting,
  initialDraft,
  title = "手动新增请假记录",
  submitLabel = "保存记录",
}: LeaveManualDialogProps) {
  const [draft, setDraft] = useState<LeaveDraft>(buildLeaveDraft(initialDraft));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(buildLeaveDraft(initialDraft));
      setError("");
    }
  }, [initialDraft, open]);

  const updateField = <K extends keyof LeaveDraft>(field: K, value: LeaveDraft[K]) => {
    setDraft((current) => {
      const next = { ...current, [field]: value } as LeaveDraft;

      if (field === "startDate" && next.startDate && next.days) {
        next.endDate = addDaysToDate(next.startDate, next.days - 1);
      }
      if (field === "endDate" && next.startDate && next.endDate) {
        next.days = diffDaysInclusive(next.startDate, next.endDate);
      }
      if (field === "days" && next.startDate && next.days) {
        next.endDate = addDaysToDate(next.startDate, Number(next.days) - 1);
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (!draft.userId) {
      setError("请选择员工。");
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      setError("请填写开始日期和结束日期。");
      return;
    }
    if (draft.startDate > draft.endDate) {
      setError("结束日期不能早于开始日期。");
      return;
    }

    setError("");
    await onSubmit(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">员工</label>
              <select
                value={draft.userId}
                onChange={(event) => updateField("userId", Number(event.target.value) || "")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">请选择员工</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || `用户-${user.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">请假类型</label>
              <select
                value={draft.type}
                onChange={(event) => updateField("type", event.target.value as LeaveDraft["type"])}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {Object.entries(leaveTypeLabelMap).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">开始日期</label>
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">结束日期</label>
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">请假天数</label>
              <input
                type="number"
                min={1}
                step={1}
                value={draft.days}
                onChange={(event) => updateField("days", Number(event.target.value) || 1)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">记录状态</label>
              <select
                value={draft.status}
                onChange={(event) =>
                  updateField("status", event.target.value as LeaveDraft["status"])
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {Object.entries(leaveStatusLabelMap).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">请假原因</label>
            <textarea
              rows={3}
              value={draft.reason}
              onChange={(event) => updateField("reason", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
