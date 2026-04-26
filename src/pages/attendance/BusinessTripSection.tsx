import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  Download,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { getCurrentCycleMonth, getCycleRangeFromMonth } from "@contracts/business-trip";
import { RouteLoading } from "@/components/RouteLoading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { StatCard } from "./StatCard";
import type { BusinessTripRecord } from "./BusinessTripForm";
import {
  buildTripDraft,
  downloadBase64File,
  rebaseTripToCycle,
  refreshTripTotals,
  toTripPayload,
  type TripDraft,
} from "./helpers";

const BusinessTripUploadTab = lazy(() =>
  import("./BusinessTripUploadTab").then((module) => ({ default: module.BusinessTripUploadTab })),
);
const BusinessTripEditDialog = lazy(() =>
  import("./BusinessTripEditDialog").then((module) => ({
    default: module.BusinessTripEditDialog,
  })),
);

function buildTripDraftFromRecord(record: BusinessTripRecord) {
  return buildTripDraft(
    {
      id: record.id,
      userId: record.userId ?? "",
      employeeName: record.employeeName,
      department: record.department,
      projectName: record.projectName ?? "",
      projectCode: record.projectCode,
      dispatchStart: record.dispatchStart,
      dispatchEnd: record.dispatchEnd,
      location: record.location,
      workDays: record.workDays,
      actualDays: record.actualDays,
      officeDays: record.officeDays,
      tripDays: record.tripDays,
      tempDays: record.tempDays,
      absenceDays: record.absenceDays,
      absenceReason: record.absenceReason ?? "",
      subsidyDays: record.subsidyDays,
      remark: record.remark ?? "",
    },
    record.cycleEnd.slice(0, 7),
  );
}

export function BusinessTripSection() {
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState("upload");
  const [uploadCycleMonth, setUploadCycleMonth] = useState(
    searchParams.get("cycleMonth") ?? getCurrentCycleMonth(),
  );
  const [listCycleMonth, setListCycleMonth] = useState(
    searchParams.get("cycleMonth") ?? getCurrentCycleMonth(),
  );
  const [listDepartment, setListDepartment] = useState(searchParams.get("department") ?? "");
  const [listSearch, setListSearch] = useState(searchParams.get("search") ?? "");
  const [exportCycleMonth, setExportCycleMonth] = useState(
    searchParams.get("cycleMonth") ?? getCurrentCycleMonth(),
  );
  const [exportDepartment, setExportDepartment] = useState(searchParams.get("department") ?? "");
  const [editingTrip, setEditingTrip] = useState<TripDraft | null>(null);
  const [editError, setEditError] = useState("");

  const listParams = useMemo(
    () => ({
      cycleMonth: listCycleMonth,
      department: listDepartment || undefined,
      search: listSearch.trim() || undefined,
    }),
    [listCycleMonth, listDepartment, listSearch],
  );

  const exportPreviewParams = useMemo(
    () => ({
      cycleMonth: exportCycleMonth,
      department: exportDepartment || undefined,
    }),
    [exportCycleMonth, exportDepartment],
  );

  const { data: users = [] } = trpc.user.list.useQuery();
  const { data: tasks = [] } = trpc.task.list.useQuery();
  const { data: departments = [] } = trpc.businessTrip.departments.useQuery();
  const { data: records = [], isLoading: isListLoading } = trpc.businessTrip.list.useQuery(listParams);
  const { data: exportRecords = [], isLoading: isExportPreviewLoading } =
    trpc.businessTrip.list.useQuery(exportPreviewParams);

  const deleteMutation = trpc.businessTrip.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.businessTrip.list.invalidate(),
        utils.businessTrip.departments.invalidate(),
      ]);
    },
  });

  const updateMutation = trpc.businessTrip.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.businessTrip.list.invalidate(),
        utils.businessTrip.departments.invalidate(),
      ]);
      setEditingTrip(null);
      setEditError("");
      const params = new URLSearchParams(searchParams);
      params.delete("editTripId");
      setSearchParams(params, { replace: true });
    },
  });

  const exportMutation = trpc.businessTrip.exportXlsx.useMutation();

  useEffect(() => {
    const nextCycleMonth = searchParams.get("cycleMonth") ?? getCurrentCycleMonth();
    const nextDepartment = searchParams.get("department") ?? "";
    const nextSearch = searchParams.get("search") ?? "";

    setUploadCycleMonth(nextCycleMonth);
    setListCycleMonth(nextCycleMonth);
    setExportCycleMonth(nextCycleMonth);
    setListDepartment(nextDepartment);
    setExportDepartment(nextDepartment);
    setListSearch(nextSearch);

    if (searchParams.get("editTripId") || nextSearch || nextDepartment) {
      setActiveTab("list");
    }
  }, [searchParams]);

  useEffect(() => {
    const editTripId = Number(searchParams.get("editTripId") || "");
    if (!editTripId || records.length === 0) return;

    const matched = records.find((record) => record.id === editTripId);
    if (matched) {
      setActiveTab("list");
      setEditingTrip(buildTripDraftFromRecord(matched));
    }
  }, [records, searchParams]);

  const listCycleLabel = useMemo(
    () => getCycleRangeFromMonth(listCycleMonth).label,
    [listCycleMonth],
  );
  const exportCycleLabel = useMemo(
    () => getCycleRangeFromMonth(exportCycleMonth).label,
    [exportCycleMonth],
  );

  const updateEditingTrip = <K extends keyof TripDraft>(field: K, value: TripDraft[K]) => {
    setEditingTrip((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value } as TripDraft;
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
    });
  };

  const syncListParams = (next: {
    cycleMonth?: string;
    department?: string;
    search?: string;
    clearEdit?: boolean;
  }) => {
    const params = new URLSearchParams(searchParams);

    if (next.cycleMonth !== undefined) {
      params.set("cycleMonth", next.cycleMonth);
    }
    if (next.department !== undefined) {
      if (next.department) {
        params.set("department", next.department);
      } else {
        params.delete("department");
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
      params.delete("editTripId");
    }

    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">出差考勤统计</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              上传识别、数据列表和导出配置统一收口在这个模块。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="出差记录" value={records.length} />
            <StatCard label="部门数量" value={departments.length} />
            <StatCard label="导出预览" value={exportRecords.length} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-white p-1 shadow-sm">
          <TabsTrigger
            value="upload"
            className="gap-2 px-2 py-3 text-xs sm:px-3 sm:text-sm"
          >
            <Upload className="h-4 w-4" />
            上传识别
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="gap-2 px-2 py-3 text-xs sm:px-3 sm:text-sm"
          >
            <Building2 className="h-4 w-4" />
            数据列表
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="gap-2 px-2 py-3 text-xs sm:px-3 sm:text-sm"
          >
            <Download className="h-4 w-4" />
            导出配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4 sm:mt-5">
          <Suspense fallback={<RouteLoading label="上传模块加载中..." />}>
            {activeTab === "upload" ? (
              <BusinessTripUploadTab
                cycleMonth={uploadCycleMonth}
                onCycleMonthChange={setUploadCycleMonth}
                users={users}
                tasks={tasks}
                onSaved={() => {
                  setListCycleMonth(uploadCycleMonth);
                  setExportCycleMonth(uploadCycleMonth);
                  setActiveTab("list");
                  syncListParams({ cycleMonth: uploadCycleMonth, clearEdit: true });
                }}
              />
            ) : null}
          </Suspense>
        </TabsContent>

        <TabsContent value="list" className="mt-4 sm:mt-5">
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(0,1fr)]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">考勤周期</label>
                  <input
                    type="month"
                    value={listCycleMonth}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setListCycleMonth(nextValue);
                      syncListParams({ cycleMonth: nextValue, clearEdit: true });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-xs text-gray-500">{listCycleLabel}</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">部门筛选</label>
                  <select
                    value={listDepartment}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setListDepartment(nextValue);
                      syncListParams({ department: nextValue, clearEdit: true });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">全部部门</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">搜索</label>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      value={listSearch}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setListSearch(nextValue);
                        syncListParams({ search: nextValue, clearEdit: true });
                      }}
                      placeholder="按员工、项目编号或地点搜索"
                      className="w-full text-sm outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
                <h3 className="text-base font-semibold text-gray-900">出差考勤列表</h3>
              </div>

              <div className="space-y-4 p-4 md:hidden">
                {isListLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                    正在加载...
                  </div>
                ) : records.length > 0 ? (
                  records.map((record) => {
                    const isHighlighted =
                      Number(searchParams.get("editTripId") || "") === record.id ||
                      editingTrip?.id === record.id;

                    return (
                      <div
                        key={record.id}
                        className={`rounded-2xl border p-4 ${
                          isHighlighted ? "border-blue-300 bg-blue-50/60" : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-gray-900">
                              {record.employeeName}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">{record.department}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingTrip(buildTripDraftFromRecord(record))}
                              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                              title="编辑"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm("确认删除这条出差考勤记录吗？")) {
                                  deleteMutation.mutate({ id: record.id });
                                }
                              }}
                              className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-gray-50 px-3 py-3">
                            <p className="text-xs text-gray-500">项目</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {record.projectCode}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {record.projectName || "未关联项目名称"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-3">
                            <p className="text-xs text-gray-500">出差地点</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {record.location}
                            </p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-3">
                            <p className="text-xs text-gray-500">考勤周期</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {record.cycleStart}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">至 {record.cycleEnd}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-3">
                            <p className="text-xs text-gray-500">派遣日期</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {record.dispatchStart || "-"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              至 {record.dispatchEnd || "-"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-3 sm:col-span-2">
                            <p className="text-xs text-gray-500">出勤统计</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              应出勤 {record.workDays}，办公区 {record.officeDays}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              长期出差 {record.tripDays}，临时外派 {record.tempDays}
                            </p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-3 sm:col-span-2">
                            <p className="text-xs text-gray-500">补贴 / 缺勤</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                              补贴 {record.subsidyDays} 天
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              缺勤 {record.absenceDays}
                              {record.absenceReason ? ` / ${record.absenceReason}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                    当前筛选条件下暂无出差考勤记录。
                  </div>
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">员工 / 部门</th>
                      <th className="px-4 py-3 font-medium">项目编号</th>
                      <th className="px-4 py-3 font-medium">考勤周期</th>
                      <th className="px-4 py-3 font-medium">派遣日期</th>
                      <th className="px-4 py-3 font-medium">地点</th>
                      <th className="px-4 py-3 font-medium">出勤统计</th>
                      <th className="px-4 py-3 font-medium">补贴 / 缺勤</th>
                      <th className="px-4 py-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isListLoading ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                          正在加载...
                        </td>
                      </tr>
                    ) : records.length > 0 ? (
                      records.map((record) => {
                        const isHighlighted =
                          Number(searchParams.get("editTripId") || "") === record.id ||
                          editingTrip?.id === record.id;

                        return (
                          <tr
                            key={record.id}
                            className={`border-t border-gray-100 align-top ${
                              isHighlighted ? "bg-blue-50/60" : ""
                            }`}
                          >
                            <td className="px-4 py-4">
                              <p className="font-medium text-gray-900">{record.employeeName}</p>
                              <p className="mt-1 text-xs text-gray-500">{record.department}</p>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>{record.projectCode}</div>
                              <div className="mt-1 text-xs text-gray-500">
                                {record.projectName || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>{record.cycleStart}</div>
                              <div className="text-xs text-gray-500">至 {record.cycleEnd}</div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>{record.dispatchStart || "-"}</div>
                              <div className="text-xs text-gray-500">
                                至 {record.dispatchEnd || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">{record.location}</td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>应出勤 {record.workDays}</div>
                              <div className="text-xs text-gray-500">
                                办公区 {record.officeDays} / 长期出差 {record.tripDays} / 临时外派{" "}
                                {record.tempDays}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-700">
                              <div>补贴 {record.subsidyDays}</div>
                              <div className="text-xs text-gray-500">
                                缺勤 {record.absenceDays}
                                {record.absenceReason ? ` / ${record.absenceReason}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingTrip(buildTripDraftFromRecord(record))}
                                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                  title="编辑"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("确认删除这条出差考勤记录吗？")) {
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
                        <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                          当前筛选条件下暂无出差考勤记录。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="export" className="mt-4 sm:mt-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">导出配置</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    按部门和考勤周期批量导出，可直接打印上交。
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const result = await exportMutation.mutateAsync({
                      cycleMonth: exportCycleMonth,
                      department: exportDepartment || undefined,
                      records: exportRecords,
                    });
                    downloadBase64File(result.fileName, result.fileBase64);
                  }}
                  disabled={exportMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {exportMutation.isPending ? "导出中..." : "导出 Excel"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">考勤周期</label>
                  <input
                    type="month"
                    value={exportCycleMonth}
                    onChange={(event) => setExportCycleMonth(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-xs text-gray-500">{exportCycleLabel}</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">部门</label>
                  <select
                    value={exportDepartment}
                    onChange={(event) => setExportDepartment(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">全部部门</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-sm leading-6 text-blue-900">
                <p className="font-medium">导出格式包含：</p>
                <ul className="mt-2 space-y-1">
                  <li>文件名按“现场考勤表-部门-月份.xlsx”生成</li>
                  <li>Sheet 名按“MMDD-MMDD”生成</li>
                  <li>按样板输出 4 行表头和长期出差重点标记</li>
                  <li>底部附带 10 条填报规则说明</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-gray-500" />
                <h3 className="text-base font-semibold text-gray-900">导出预览</h3>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">记录数量</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{exportRecords.length}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">导出部门</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {exportDepartment || "全部部门"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 md:hidden">
                {isExportPreviewLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                    正在加载导出预览...
                  </div>
                ) : exportRecords.length > 0 ? (
                  exportRecords.map((record) => (
                    <div key={record.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{record.employeeName}</p>
                          <p className="mt-1 text-xs text-gray-500">{record.department}</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          补贴 {record.subsidyDays}
                        </span>
                      </div>
                      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-700">
                        项目编号：{record.projectCode}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                    当前导出条件下没有数据。
                  </div>
                )}
              </div>

              <div className="mt-4 hidden max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 md:block">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">员工</th>
                      <th className="px-4 py-3 font-medium">部门</th>
                      <th className="px-4 py-3 font-medium">项目编号</th>
                      <th className="px-4 py-3 font-medium">补贴天数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isExportPreviewLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                          正在加载导出预览...
                        </td>
                      </tr>
                    ) : exportRecords.length > 0 ? (
                      exportRecords.map((record) => (
                        <tr key={record.id} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-gray-900">{record.employeeName}</td>
                          <td className="px-4 py-3 text-gray-700">{record.department}</td>
                          <td className="px-4 py-3 text-gray-700">{record.projectCode}</td>
                          <td className="px-4 py-3 text-gray-700">{record.subsidyDays}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                          当前导出条件下没有数据。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Suspense fallback={<RouteLoading label="编辑模块加载中..." />}>
        {editingTrip ? (
          <BusinessTripEditDialog
            editingTrip={editingTrip}
            users={users}
            tasks={tasks}
            editError={editError}
            isSaving={updateMutation.isPending}
            onOpenChange={(open) => {
              if (!open) {
                setEditingTrip(null);
                setEditError("");
                syncListParams({ clearEdit: true });
              }
            }}
            onChange={updateEditingTrip}
            onValidationError={setEditError}
            onSubmit={async (trip) => {
              if (!trip.id) return;
              setEditError("");
              await updateMutation.mutateAsync({
                id: trip.id,
                ...toTripPayload(trip),
              });
            }}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
