import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TripFormFields, TripMetrics } from "./BusinessTripForm";
import { type TripDraft, type UserOption, validateTrip } from "./helpers";

export function BusinessTripEditDialog({
  editingTrip,
  users,
  editError,
  isSaving,
  onOpenChange,
  onChange,
  onSubmit,
  onValidationError,
}: {
  editingTrip: TripDraft | null;
  users: UserOption[];
  editError: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: <K extends keyof TripDraft>(field: K, value: TripDraft[K]) => void;
  onSubmit: (trip: TripDraft) => Promise<void>;
  onValidationError: (message: string) => void;
}) {
  return (
    <Dialog open={!!editingTrip} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑出差考勤记录</DialogTitle>
        </DialogHeader>

        {editingTrip ? (
          <div className="space-y-5">
            <TripFormFields trip={editingTrip} users={users} onChange={onChange} />
            <TripMetrics trip={editingTrip} />

            {editError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const validationMessage = validateTrip(editingTrip);
                  if (validationMessage) {
                    onValidationError(validationMessage);
                    return;
                  }
                  await onSubmit(editingTrip);
                }}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存修改
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
