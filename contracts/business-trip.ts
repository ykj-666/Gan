export type CycleRange = {
  cycleMonth: string;
  cycleStart: string;
  cycleEnd: string;
  label: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getCycleRangeFromMonth(cycleMonth: string): CycleRange {
  const [year, month] = cycleMonth.split("-").map(Number);
  const cycleStart = new Date(year, month - 2, 25);
  const cycleEnd = new Date(year, month - 1, 24);

  return {
    cycleMonth,
    cycleStart: formatDate(cycleStart),
    cycleEnd: formatDate(cycleEnd),
    label: `${formatDate(cycleStart)}-${formatDate(cycleEnd)}`,
  };
}

export function getCurrentCycleMonth(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cycleMonth = now.getDate() >= 25 ? month + 1 : month;
  const finalYear = cycleMonth === 13 ? year + 1 : year;
  const finalMonth = cycleMonth === 13 ? 1 : cycleMonth;
  return `${finalYear}-${pad(finalMonth)}`;
}

export function daysInclusive(start: string, end: string) {
  if (!start || !end) return 0;
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (startDate > endDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
}

export function workdaysInclusive(start: string, end: string) {
  if (!start || !end) return 0;
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (startDate > endDate) return 0;

  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function overlapRange(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  if (!startA || !endA || !startB || !endB) return null;
  const start = parseDate(startA) > parseDate(startB) ? startA : startB;
  const end = parseDate(endA) < parseDate(endB) ? endA : endB;
  return parseDate(start) <= parseDate(end) ? { start, end } : null;
}

export function calculateBusinessTripMetrics(args: {
  cycleStart: string;
  cycleEnd: string;
  dispatchStart: string;
  dispatchEnd: string;
  workDays?: number;
  officeDays?: number;
  tripDays?: number;
  tempDays?: number;
  subsidyDays?: number;
}) {
  const overlap = overlapRange(
    args.dispatchStart,
    args.dispatchEnd,
    args.cycleStart,
    args.cycleEnd,
  );

  const cycleWorkDays = args.workDays ?? daysInclusive(args.cycleStart, args.cycleEnd);
  const tripDays =
    args.tripDays ??
    (overlap ? daysInclusive(overlap.start, overlap.end) : 0);
  const tempDays = args.tempDays ?? 0;
  const officeDays =
    args.officeDays ?? Math.max(cycleWorkDays - tripDays - tempDays, 0);
  const actualDays = officeDays + tripDays + tempDays;
  const absenceDays = Math.max(cycleWorkDays - actualDays, 0);
  const subsidyDays =
    args.subsidyDays ?? (overlap ? daysInclusive(overlap.start, overlap.end) : 0);

  return {
    workDays: cycleWorkDays,
    actualDays,
    officeDays,
    tripDays,
    tempDays,
    absenceDays,
    subsidyDays,
  };
}
