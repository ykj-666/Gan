import {
  calculateBusinessTripMetrics,
  getCurrentCycleMonth,
  getCycleRangeFromMonth,
} from "@contracts/business-trip";

export const leaveTypeLabelMap: Record<string, string> = {
  sick: "病假",
  annual: "年假",
  personal: "事假",
  marriage: "婚假",
  maternity: "产假",
  other: "其他",
};

export const leaveStatusLabelMap: Record<string, string> = {
  pending: "待处理",
  approved: "已确认",
  rejected: "已驳回",
};

export type LeaveDraft = {
  userId: number | "";
  type: "sick" | "annual" | "personal" | "marriage" | "maternity" | "other";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

export type UserOption = {
  id: number;
  name: string | null;
  department?: string | null;
};

export type TripDraft = {
  id?: number;
  userId: number | "";
  cycleMonth: string;
  cycleStart: string;
  cycleEnd: string;
  employeeName: string;
  department: string;
  projectCode: string;
  dispatchStart: string;
  dispatchEnd: string;
  location: string;
  workDays: number;
  actualDays: number;
  officeDays: number;
  tripDays: number;
  tempDays: number;
  absenceDays: number;
  absenceReason: string;
  subsidyDays: number;
  remark: string;
};

export type RecognizedTrip = {
  employeeName: string;
  department: string;
  dispatchStart: string;
  dispatchEnd: string;
  location: string;
  projectCode: string;
};

export function matchUserByName(name: string, users: UserOption[]) {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const exact = users.find((user) => user.name?.trim() === trimmed);
  if (exact) return exact;

  return users.find((user) => {
    const userName = user.name?.trim();
    return userName ? userName.includes(trimmed) || trimmed.includes(userName) : false;
  });
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getMonthValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function getMonthDateRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
  };
}

export function addDaysToDate(dateStr: string, days: number) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function diffDaysInclusive(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 1;
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function buildLeaveDraft(seed: Partial<LeaveDraft> = {}): LeaveDraft {
  const startDate = seed.startDate ?? "";
  const endDate = seed.endDate ?? startDate;
  return {
    userId: seed.userId ?? "",
    type: seed.type ?? "other",
    startDate,
    endDate,
    days:
      seed.days ??
      (startDate && endDate ? diffDaysInclusive(startDate, endDate) : 1),
    reason: seed.reason ?? "",
    status: seed.status ?? "approved",
  };
}

export function buildTripDraft(
  seed: Partial<TripDraft> = {},
  cycleMonth = getCurrentCycleMonth(),
): TripDraft {
  const cycle = getCycleRangeFromMonth(cycleMonth);
  const metrics = calculateBusinessTripMetrics({
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    dispatchStart: seed.dispatchStart ?? "",
    dispatchEnd: seed.dispatchEnd ?? "",
  });

  return {
    id: seed.id,
    userId: seed.userId ?? "",
    cycleMonth,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    employeeName: seed.employeeName ?? "",
    department: seed.department ?? "",
    projectCode: seed.projectCode ?? "",
    dispatchStart: seed.dispatchStart ?? "",
    dispatchEnd: seed.dispatchEnd ?? "",
    location: seed.location ?? "",
    workDays: seed.workDays ?? metrics.workDays,
    actualDays: seed.actualDays ?? metrics.actualDays,
    officeDays: seed.officeDays ?? metrics.officeDays,
    tripDays: seed.tripDays ?? metrics.tripDays,
    tempDays: seed.tempDays ?? metrics.tempDays,
    absenceDays: seed.absenceDays ?? metrics.absenceDays,
    absenceReason: seed.absenceReason ?? "",
    subsidyDays: seed.subsidyDays ?? metrics.subsidyDays,
    remark: seed.remark ?? "",
  };
}

export function rebaseTripToCycle(trip: TripDraft, cycleMonth: string) {
  const cycle = getCycleRangeFromMonth(cycleMonth);
  const metrics = calculateBusinessTripMetrics({
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    dispatchStart: trip.dispatchStart,
    dispatchEnd: trip.dispatchEnd,
    tempDays: trip.tempDays,
  });

  return {
    ...trip,
    cycleMonth,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    workDays: metrics.workDays,
    actualDays: metrics.actualDays,
    officeDays: metrics.officeDays,
    tripDays: metrics.tripDays,
    absenceDays: metrics.absenceDays,
    subsidyDays: metrics.subsidyDays,
  };
}

export function refreshTripTotals(trip: TripDraft) {
  const metrics = calculateBusinessTripMetrics({
    cycleStart: trip.cycleStart,
    cycleEnd: trip.cycleEnd,
    dispatchStart: trip.dispatchStart,
    dispatchEnd: trip.dispatchEnd,
    workDays: trip.workDays,
    officeDays: trip.officeDays,
    tripDays: trip.tripDays,
    tempDays: trip.tempDays,
    subsidyDays: trip.subsidyDays,
  });

  return {
    ...trip,
    workDays: metrics.workDays,
    actualDays: metrics.actualDays,
    officeDays: metrics.officeDays,
    tripDays: metrics.tripDays,
    tempDays: metrics.tempDays,
    absenceDays: metrics.absenceDays,
    subsidyDays: metrics.subsidyDays,
  };
}

export function validateTrip(trip: TripDraft) {
  if (!trip.userId) return "请选择员工";
  if (!trip.employeeName.trim()) return "员工姓名不能为空";
  if (!trip.department.trim()) return "部门不能为空";
  if (!trip.projectCode.trim()) return "项目编号不能为空";
  if (!trip.dispatchStart) return "派遣起始日不能为空";
  if (!trip.dispatchEnd) return "派遣结束日不能为空";
  if (trip.dispatchStart > trip.dispatchEnd) return "派遣结束日不能早于起始日";
  if (!trip.location.trim()) return "出差地点不能为空";
  if (trip.absenceDays > 0 && !trip.absenceReason.trim()) {
    return "缺勤天数大于 0 时必须填写缺勤原因";
  }
  const cycleDays =
    Math.floor(
      (new Date(trip.cycleEnd).getTime() - new Date(trip.cycleStart).getTime()) /
        86400000,
    ) + 1;
  if (trip.subsidyDays > cycleDays && !trip.remark.trim()) {
    return "出差补贴天数超过周期天数时必须填写备注";
  }
  return null;
}

export function toTripPayload(trip: TripDraft) {
  return {
    userId: Number(trip.userId),
    employeeName: trip.employeeName.trim(),
    department: trip.department.trim(),
    projectCode: trip.projectCode.trim(),
    cycleStart: trip.cycleStart,
    cycleEnd: trip.cycleEnd,
    dispatchStart: trip.dispatchStart,
    dispatchEnd: trip.dispatchEnd,
    location: trip.location.trim(),
    workDays: trip.workDays,
    officeDays: trip.officeDays,
    tripDays: trip.tripDays,
    tempDays: trip.tempDays,
    absenceReason: trip.absenceReason.trim() || undefined,
    subsidyDays: trip.subsidyDays,
    remark: trip.remark.trim() || undefined,
  };
}

export function downloadBase64File(fileName: string, fileBase64: string) {
  const binary = window.atob(fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
