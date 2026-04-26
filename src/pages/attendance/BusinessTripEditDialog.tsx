import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TripFormFields, TripMetrics } from "./BusinessTripForm";
import { type TripDraft, type UserOption, validateTrip } from "./helpers";

export function BusinessTripEditDialog({
  editingTrip,
  users,
  tasks,
  editError,
  isSaving,
  onOpenChange,
  onChange,
  onSubmit,
  onValidationError,
}: {
  editingTrip: TripDraft | null;
  users: UserOption[];
  tasks: Array<{ projectName: string; projectCode: string | null }>;
  editError: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: <K extends keyof TripDraft>(field: K, value: TripDraft[K]) => void;
  onSubmit: (trip: TripDraft) => Promise<void>;
  onValidationError: (message: string) => void;
}) {
  return (
    <Dialog open={!!editingTrip} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-[calc(100%-0.5rem)] overflow-y-auto rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-lg sm:p-6">
        <DialogHeader className="border-b border-gray-100 pb-4 sm:border-b-0 sm:pb-0">
          <DialogTitle>编辑出差考勤记录</DialogTitle>
        </DialogHeader>

        {editingTrip ? (
          <div className="space-y-5 py-4 sm:py-0">
            <TripFormFields trip={editingTrip} users={users} tasks={tasks} onChange={onChange} />
            <TripMetrics trip={editingTrip} />

            {editError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end sm:border-t-0 sm:pt-0">
              <button
                onClick={() => onOpenChange(false)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
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
