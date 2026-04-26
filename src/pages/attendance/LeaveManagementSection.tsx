import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { trpc } from "@/providers/trpc";
import { StatCard } from "./StatCard";
import {
  buildLeaveDraft,
  getMonthDateRange,
  getMonthValue,
  leaveStatusLabelMap,
  leaveTypeLabelMap,
  type LeaveDraft,
} from "./helpers";

const SmartLeaveRecognition = lazy(() => import("@/components/SmartLeaveRecognition"));
const LeaveManualDialog = lazy(() =>
  import("./LeaveManualDialog").then((module) => ({ default: module.LeaveManualDialog })),
);

function buildDraftFromRecord(record: {
  userId: number;
  type: LeaveDraft["type"];
  startDate: string;
  endDate: string;
  days: number | null;
  reason: string | null;
  status: LeaveDraft["status"];
}) {
  return buildLeaveDraft({
    userId: record.userId,
    type: record.type,
    startDate: record.startDate,
    endDate: record.endDate,
    days: record.days ?? undefined,
    reason: record.reason ?? "",
    status: record.status,
  });
}

export function LeaveManagementSection() {
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return getMonthValue(date);
    });
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") ?? getMonthValue());
  const [userFilter, setUserFilter] = useState(searchParams.get("userId") ?? "all");
  const [keyword, setKeyword] = useState(searchParams.get("search") ?? "");
  const [showSmartRecognition, setShowSmartRecognition] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<number | null>(null);

  const monthRange = useMemo(() => getMonthDateRange(month), [month]);
  const utils = trpc.useUtils();

  const { data: users = [] } = trpc.user.list.useQuery();
  const { data: records = [], isLoading } = trpc.attendance.list.useQuery({
    ...monthRange,
    userId: userFilter === "all" ? undefined : Number(userFilter),
  });
  const { data: stats } = trpc.attendance.stats.useQuery(monthRange);

  const createMutation = trpc.attendance.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.attendance.list.invalidate(), utils.attendance.stats.invalidate()]);
    },
  });

  const updateMutation = trpc.attendance.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.attendance.list.invalidate(), utils.attendance.stats.invalidate()]);
      setEditingLeaveId(null);
    },
  });

  const deleteMutation = trpc.attendance.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.attendance.list.invalidate(), utils.attendance.stats.invalidate()]);
    },
  });

  useEffect(() => {
    setMonth(searchParams.get("month") ?? getMonthValue());
    setUserFilter(searchParams.get("userId") ?? "all");
    setKeyword(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const editLeaveId = Number(searchParams.get("editLeaveId") || "");
    if (!editLeaveId || records.length === 0) return;
    const matched = records.find((record) => record.id === editLeaveId);
    if (matched) {
      setEditingLeaveId(matched.id);
      setShowManualDialog(true);
    }
  }, [records, searchParams]);

  const filteredRecords = useMemo(() => {
    const searchLower = keyword.trim().toLowerCase();
    if (!searchLower) return records;
    return records.filter((record) => {
      return (
        record.userName.toLowerCase().includes(searchLower) ||
        (record.userDepartment?.toLowerCase().includes(searchLower) ?? false) ||
        (record.reason?.toLowerCase().includes(searchLower) ?? false)
      );
    });
  }, [keyword, records]);

  const editingRecord = editingLeaveId
    ? records.find((record) => record.id === editingLeaveId) ?? null
    : null;

  const handleCreateLeave = async (draft: LeaveDraft) => {
    await createMutation.mutateAsync({
      userId: Number(draft.userId),
      type: draft.type,
      startDate: draft.startDate,
      endDate: draft.endDate,
      days: draft.days,
      reason: draft.reason.trim() || undefined,
      status: draft.status,
    });
  };

  const handleUpdateLeave = async (draft: LeaveDraft) => {
    if (!editingRecord) return;
    await updateMutation.mutateAsync({
      id: editingRecord.id,
      userId: Number(draft.userId),
      type: draft.type,
      startDate: draft.startDate,
      endDate: draft.endDate,
      days: draft.days,
      reason: draft.reason.trim() || undefined,
      status: draft.status,
    });
  };

  const syncParams = (next: { month?: string; userId?: string; search?: string; clearEdit?: boolean }) => {
    const params = new URLSearchParams(searchParams);
    if (next.month !== undefined) {
      params.set("month", next.month);
    }
    if (next.userId !== undefined) {
      if (next.userId === "all") {
        params.delete("userId");
      } else {
        params.set("userId", next.userId);
      }
    }
    if (next.search !== undefined) {
      if (next.search.trim()) {
        params.set("search", next.search.trim());
      } else {
        params.delete("search");
      }
    }
    if (next.clearEdit) {
      params.delete("editLeaveId");
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">请假管理</h2>
            <p className="mt-1 text-sm text-gray-500">保留请假统计、识别导入、手动录入和记录编辑能力。</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">统计月份</label>
              <select
                value={month}
                onChange={(event) => {
                  const nextMonth = event.target.value;
                  setMonth(nextMonth);
                  syncParams({ month: nextMonth, clearEdit: true });
                }}
                className="min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">员工筛选</label>
              <select
                value={userFilter}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  setUserFilter(nextUserId);
                  syncParams({ userId: nextUserId, clearEdit: true });
                }}
                className="min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">全部员工</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || `用户-${user.id}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowSmartRecognition(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Sparkles className="h-4 w-4" />
              智能识别
            </button>

            <button
              onClick={() => {
                setEditingLeaveId(null);
                setShowManualDialog(true);
                syncParams({ clearEdit: true });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              添加请假
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="请假记录数" value={stats?.total ?? 0} />
        <StatCard label="病假" value={stats?.sick ?? 0} accent="text-red-600" />
        <StatCard label="年假" value={stats?.annual ?? 0} accent="text-amber-600" />
        <StatCard
          label="事假 / 其他"
          value={(stats?.personal ?? 0) + (stats?.other ?? 0)}
          accent="text-blue-600"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={(event) => {
                const next = event.target.value;
                setKeyword(next);
                syncParams({ search: next, clearEdit: true });
              }}
              placeholder="搜索员工、部门、请假原因"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            当前结果 {filteredRecords.length} 条
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">请假记录列表</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">员工</th>
                <th className="px-4 py-3 font-medium">部门</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">开始日期</th>
                <th className="px-4 py-3 font-medium">结束日期</th>
                <th className="px-4 py-3 font-medium">天数</th>
                <th className="px-4 py-3 font-medium">原因</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    正在加载...
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => {
                  const isHighlighted =
                    Number(searchParams.get("editLeaveId") || "") === record.id ||
                    editingLeaveId === record.id;

                  return (
                    <tr
                      key={record.id}
                      className={`border-t border-gray-100 ${
                        isHighlighted ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-4 font-medium text-gray-900">{record.userName}</td>
                      <td className="px-4 py-4 text-gray-700">{record.userDepartment || "-"}</td>
                      <td className="px-4 py-4 text-gray-700">
                        {leaveTypeLabelMap[record.type] || record.type}
                      </td>
                      <td className="px-4 py-4 text-gray-700">{record.startDate}</td>
                      <td className="px-4 py-4 text-gray-700">{record.endDate}</td>
                      <td className="px-4 py-4 text-gray-700">{record.days ?? "-"}</td>
                      <td className="px-4 py-4 text-gray-700">{record.reason || "-"}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            record.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : record.status === "rejected"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {leaveStatusLabelMap[record.status] || record.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingLeaveId(record.id);
                              setShowManualDialog(true);
                            }}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("确认删除这条请假记录吗？")) {
                                deleteMutation.mutate({ id: record.id });
                              }
                            }}
                            className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    当前筛选条件下暂无请假记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Suspense fallback={<RouteLoading label="模块加载中..." />}>
        {showSmartRecognition ? (
          <SmartLeaveRecognition
            isOpen={showSmartRecognition}
            onClose={() => setShowSmartRecognition(false)}
            userList={users}
            onSaved={async () => {
              await Promise.all([utils.attendance.list.invalidate(), utils.attendance.stats.invalidate()]);
            }}
          />
        ) : null}

        {showManualDialog ? (
          <LeaveManualDialog
            open={showManualDialog}
            onOpenChange={(open) => {
              setShowManualDialog(open);
              if (!open) {
                setEditingLeaveId(null);
                syncParams({ clearEdit: true });
              }
            }}
            users={users}
            initialDraft={editingRecord ? buildDraftFromRecord(editingRecord) : undefined}
            onSubmit={editingRecord ? handleUpdateLeave : handleCreateLeave}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            title={editingRecord ? "编辑请假记录" : "手动新增请假记录"}
            submitLabel={editingRecord ? "保存修改" : "保存记录"}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
