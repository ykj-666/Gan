import type { inferRouterOutputs } from "@trpc/server";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Search, Trash2, Upload, UserPlus, Wand2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { trpc } from "@/providers/trpc";
import type { EditableEmployee } from "./types";
import type { AppRouter } from "../../../api/router";
import { EmployeeDetailSheet, type MemberSummary } from "./EmployeeDetailSheet";

const AvatarEditor = lazy(() =>
  import("@/components/AvatarEditor").then((module) => ({
    default: module.AvatarEditor,
  })),
);
const EmployeeImportModal = lazy(() =>
  import("@/components/EmployeeImportModal").then((module) => ({
    default: module.EmployeeImportModal,
  })),
);
const SmartEmployeeRecognition = lazy(() => import("@/components/SmartEmployeeRecognition"));
const AddEmployeeDialog = lazy(() =>
  import("./AddEmployeeDialog").then((module) => ({
    default: module.AddEmployeeDialog,
  })),
);

type RouterOutputs = inferRouterOutputs<AppRouter>;

type EditableAvatar = {
  id: number;
  name: string;
  avatar?: string | null;
};

export function TeamPage() {
  const { data: stats, isLoading } = trpc.stats.dashboard.useQuery();
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSmartOpen, setIsSmartOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EditableEmployee | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<EditableAvatar | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<MemberSummary | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [roleFilter, setRoleFilter] = useState<
    "all" | RouterOutputs["stats"]["dashboard"]["memberStats"][number]["role"]
  >((searchParams.get("role") as "all" | "user" | "admin") || "all");
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get("department") ?? "all");

  const members = stats?.memberStats ?? [];

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setRoleFilter((searchParams.get("role") as "all" | "user" | "admin") || "all");
    setDepartmentFilter(searchParams.get("department") ?? "all");
  }, [searchParams]);

  useEffect(() => {
    const memberId = Number(searchParams.get("memberId") || "");
    if (!memberId || members.length === 0) return;
    const matched = members.find((member) => member.id === memberId);
    if (matched) {
      setDetailEmployee(matched);
    }
  }, [members, searchParams]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        members
          .map((member) => member.department?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((left, right) => left.localeCompare(right, "zh-CN"));
  }, [members]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchSearch =
        !keyword ||
        member.name.toLowerCase().includes(keyword) ||
        member.department?.toLowerCase().includes(keyword) ||
        member.email?.toLowerCase().includes(keyword);

      const matchRole = roleFilter === "all" || member.role === roleFilter;
      const matchDepartment = departmentFilter === "all" || member.department === departmentFilter;

      return matchSearch && matchRole && matchDepartment;
    });
  }, [departmentFilter, members, roleFilter, search]);

  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: () => {
      void utils.user.list.invalidate();
      void utils.stats.dashboard.invalidate();
      setDetailEmployee(null);
    },
  });

  const syncParams = (next: {
    search?: string;
    role?: string;
    department?: string;
    memberId?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams);

    if (next.search !== undefined) {
      if (next.search.trim()) params.set("search", next.search.trim());
      else params.delete("search");
    }

    if (next.role !== undefined) {
      if (next.role && next.role !== "all") params.set("role", next.role);
      else params.delete("role");
    }

    if (next.department !== undefined) {
      if (next.department && next.department !== "all") params.set("department", next.department);
      else params.delete("department");
    }

    if (next.memberId !== undefined) {
      if (next.memberId) params.set("memberId", next.memberId);
      else params.delete("memberId");
    }

    setSearchParams(params, { replace: true });
  };

  const handleEdit = (member: EditableEmployee) => {
    setEditingEmployee(member);
    setIsAddOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`确认删除员工“${name}”吗？`)) {
      deleteUser.mutate({ id });
    }
  };

  return (
    <>
      <header className="flex h-[64px] items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">员工管理</h1>
          <p className="text-xs text-gray-500">{members.length} 位员工</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSmartOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
          >
            <Wand2 className="h-4 w-4" />
            智能识别
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            批量导入
          </button>
          <button
            onClick={() => {
              setEditingEmployee(null);
              setIsAddOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <UserPlus className="h-4 w-4" />
            添加员工
          </button>
        </div>
      </header>

      <main className="space-y-4 px-6 pb-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearch(next);
                  syncParams({ search: next, memberId: null });
                }}
                placeholder="搜索姓名、部门、邮箱"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={departmentFilter}
                onChange={(event) => {
                  const next = event.target.value;
                  setDepartmentFilter(next);
                  syncParams({ department: next, memberId: null });
                }}
                className="h-10 w-full bg-transparent text-sm text-gray-700 outline-none"
              >
                <option value="all">全部部门</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <select
              value={roleFilter}
              onChange={(event) => {
                const next = event.target.value as typeof roleFilter;
                setRoleFilter(next);
                syncParams({ role: next, memberId: null });
              }}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              <option value="all">全部角色</option>
              <option value="admin">管理员</option>
              <option value="user">员工</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2.5 py-1">当前结果 {filteredMembers.length} 人</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1">
              任务总量 {filteredMembers.reduce((sum, member) => sum + member.total, 0)}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1">
              当前负载 {filteredMembers.reduce((sum, member) => sum + member.currentLoad, 0)}
            </span>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 shadow-sm">
            加载中...
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMembers.map((member, index) => (
              <div
                key={member.id}
                className="animate-float-in rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setDetailEmployee(member);
                    syncParams({ memberId: String(member.id) });
                  }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="group relative cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingAvatar({
                          id: member.id,
                          name: member.name ?? "",
                          avatar: member.avatar,
                        });
                      }}
                    >
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name ?? ""}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600 ring-2 ring-gray-100">
                          {(member.name ?? "U")[0]}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <Pencil className="h-2.5 w-2.5 text-gray-500" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-gray-900">{member.name}</h3>
                        <span
                          className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            member.role === "admin"
                              ? "border border-amber-100 bg-amber-50 text-amber-700"
                              : "border border-gray-100 bg-gray-50 text-gray-600"
                          }`}
                        >
                          {member.role === "admin" ? "管理员" : "员工"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {member.department || "未设置部门"} / {member.total} 个任务
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-gray-500">完成率</p>
                      <p className="mt-1 font-semibold text-emerald-600">{member.efficiency}%</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-gray-500">当前负载</p>
                      <p className="mt-1 font-semibold text-blue-600">{member.currentLoad}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-gray-500">逾期任务</p>
                      <p className="mt-1 font-semibold text-red-500">{member.overdue}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-gray-500">出差异常</p>
                      <p className="mt-1 font-semibold text-amber-600">{member.tripAlertCount}</p>
                    </div>
                  </div>
                </button>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => {
                      setDetailEmployee(member);
                      syncParams({ memberId: String(member.id) });
                    }}
                    className="rounded-lg bg-blue-50 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    详情
                  </button>
                  <button
                    onClick={() =>
                      handleEdit({
                        id: member.id,
                        name: member.name ?? "",
                        department: member.department,
                        email: member.email,
                        role: member.role,
                      })
                    }
                    className="flex items-center justify-center gap-1 rounded-lg bg-gray-50 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <Pencil className="h-3 w-3" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(member.id, member.name ?? "")}
                    className="flex items-center justify-center gap-1 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400 shadow-sm">
            没有匹配的员工数据，请调整筛选条件。
          </div>
        )}
      </main>

      <EmployeeDetailSheet
        open={!!detailEmployee}
        employee={detailEmployee}
        onOpenChange={(open) => {
          if (!open) {
            setDetailEmployee(null);
            syncParams({ memberId: null });
          }
        }}
      />

      <Suspense fallback={<RouteLoading label="模块加载中..." />}>
        {isImportOpen ? <EmployeeImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} /> : null}

        {isSmartOpen ? (
          <SmartEmployeeRecognition isOpen={isSmartOpen} onClose={() => setIsSmartOpen(false)} />
        ) : null}

        {isAddOpen ? (
          <AddEmployeeDialog
            isOpen={isAddOpen}
            onClose={() => {
              setIsAddOpen(false);
              setEditingEmployee(null);
            }}
            editingEmployee={editingEmployee}
          />
        ) : null}

        {editingAvatar ? (
          <AvatarEditor
            currentAvatar={editingAvatar.avatar}
            name={editingAvatar.name}
            userId={editingAvatar.id}
            onSave={() => {
              void utils.user.list.invalidate();
              void utils.stats.dashboard.invalidate();
            }}
            onClose={() => setEditingAvatar(null)}
          />
        ) : null}
      </Suspense>
    </>
  );
}
