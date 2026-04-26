import { useState } from "react";
import { History, Loader2, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";

const groupOptions = [
  { value: "all", label: "全部模块" },
  { value: "task", label: "任务" },
  { value: "user", label: "员工" },
  { value: "leave", label: "请假" },
  { value: "trip", label: "出差" },
] as const;

const dayOptions = [
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
  { value: 90, label: "近 90 天" },
] as const;

function getGroupLabel(type: string) {
  if (type.startsWith("task") || type === "status_changed") return "任务";
  if (type.startsWith("user")) return "员工";
  if (type.startsWith("leave")) return "请假";
  if (type.startsWith("trip")) return "出差";
  return "其他";
}

export function ActivityLogsPage() {
  const [search, setSearch] = useState("");
  const [typeGroup, setTypeGroup] = useState<(typeof groupOptions)[number]["value"]>("all");
  const [days, setDays] = useState<(typeof dayOptions)[number]["value"]>(30);

  const { data: logs = [], isLoading } = trpc.activity.list.useQuery({
    limit: 200,
    search: search.trim() || undefined,
    typeGroup,
    days,
  });

  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">操作日志</h1>
          <p className="text-xs text-gray-500">统一查看任务、员工、请假和出差的管理动作</p>
        </div>
      </header>

      <main className="space-y-5 px-4 pb-6 sm:px-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px]">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索操作人或动作描述"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <select
              value={typeGroup}
              onChange={(event) => setTypeGroup(event.target.value as typeof typeGroup)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as typeof days)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
            >
              {dayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">日志列表</h3>
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {isLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在加载...</span>
                </div>
              </div>
            ) : logs.length ? (
              logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                        {getGroupLabel(log.type)}
                      </span>
                      <p className="mt-3 text-sm font-semibold text-gray-900">
                        {log.actorName || (log.userId ? `用户-${log.userId}` : "系统")}
                      </p>
                    </div>
                    <p className="text-right text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-700">{log.description}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-gray-400">
                当前筛选条件下没有日志
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">模块</th>
                  <th className="px-4 py-3 font-medium">操作人</th>
                  <th className="px-4 py-3 font-medium">动作</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>正在加载...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length ? (
                  logs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-gray-700">{getGroupLabel(log.type)}</td>
                      <td className="px-4 py-3 text-gray-900">
                        {log.actorName || (log.userId ? `用户-${log.userId}` : "系统")}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.description}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(log.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                      当前筛选条件下没有日志
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
