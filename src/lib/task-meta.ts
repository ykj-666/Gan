export const TASK_STATUS_META = {
  todo: {
    label: "待处理",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
  },
  in_progress: {
    label: "进行中",
    color: "#10B981",
    bg: "rgba(16,185,129,0.12)",
  },
  review: {
    label: "审核中",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
  done: {
    label: "已完成",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
} as const;

export const TASK_PRIORITY_META = {
  low: { label: "低", color: "#6B7280" },
  medium: { label: "中", color: "#3B82F6" },
  high: { label: "高", color: "#F59E0B" },
  urgent: { label: "紧急", color: "#EF4444" },
} as const;

export const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "待处理" },
  { value: "in_progress", label: "进行中" },
  { value: "review", label: "审核中" },
  { value: "done", label: "已完成" },
] as const;

export const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
] as const;

export const TASK_PROJECT_TYPE_OPTIONS = [
  "建筑设计",
  "结构设计",
  "机电设计",
  "室内设计",
  "景观设计",
  "规划设计",
  "其他",
] as const;

export const TASK_SPECIALTY_OPTIONS = [
  "建筑",
  "结构",
  "给排水",
  "电气",
  "暖通",
  "景观",
  "室内",
  "规划",
  "其他",
] as const;
