import { useState } from "react";
import { Routes, Route } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { MetricCards } from "@/components/MetricCards";
import { TaskList } from "@/components/TaskList";
import { TaskBoard } from "@/components/TaskBoard";
import { TeamRadar } from "@/components/TeamRadar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TaskModal } from "@/components/TaskModal";
import { FeatureSection } from "@/components/FeatureSection";
import { EmployeeImportModal } from "@/components/EmployeeImportModal";
import { AvatarEditor } from "@/components/AvatarEditor";
import { Search, Bell, Plus, Upload, Pencil } from "lucide-react";
import type { Task } from "@db/schema";
import { trpc } from "@/providers/trpc";

/* ─────────────────────── Dashboard ─────────────────────── */
function DashboardPage() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between h-[72px] px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-sm text-gray-500">概览团队工作状态</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="全局搜索..."
              className="glass-input pl-10 pr-4 py-2.5 text-sm w-64 text-gray-800 placeholder:text-gray-400"
            />
          </div>
          <button className="relative p-2.5 rounded-xl hover:bg-white/40 transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="px-8 pb-8 space-y-5 overflow-y-auto scrollbar-thin">
        <MetricCards />
        <div className="grid grid-cols-[65%_35%] gap-5">
          <div className="space-y-5">
            <TaskList
              onEditTask={(task) => { setEditingTask(task); setIsModalOpen(true); }}
              onCreateTask={() => { setEditingTask(null); setIsModalOpen(true); }}
            />
          </div>
          <div className="space-y-5">
            <TeamRadar />
            <ActivityFeed />
          </div>
        </div>
        <FeatureSection />
      </main>

      <TaskModal
        task={editingTask}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
      />
    </>
  );
}

/* ─────────────────────── Board ─────────────────────── */
function BoardPage() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between h-[72px] px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务看板</h1>
          <p className="text-sm text-gray-500">拖拽卡片变更任务状态</p>
        </div>
        <button
          onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
          className="btn-jelly flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-indigo-500/25"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Plus className="w-4 h-4" />
          新建任务
        </button>
      </header>

      <main className="px-8 pb-8 flex-1 min-h-0">
        <TaskBoard
          onEditTask={(task) => { setEditingTask(task); setIsModalOpen(true); }}
          onCreateTask={() => { setEditingTask(null); setIsModalOpen(true); }}
        />
      </main>

      <TaskModal
        task={editingTask}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
      />
    </>
  );
}

/* ─────────────────────── Team ─────────────────────── */
function TeamPage() {
  const { data: userList, isLoading } = trpc.user.list.useQuery();
  const { data: stats } = trpc.stats.dashboard.useQuery();
  const utils = trpc.useUtils();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState<{ id: number; name: string; avatar?: string | null } | null>(null);

  const getMemberStats = (userId: number) => {
    return stats?.memberStats.find((m) => m.id === userId);
  };

  return (
    <>
      <header className="flex items-center justify-between h-[72px] px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">团队成员</h1>
          <p className="text-sm text-gray-500">
            {userList?.length ?? 0} 位成员
          </p>
        </div>
        <button
          onClick={() => setIsImportOpen(true)}
          className="btn-jelly flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-emerald-500/25"
          style={{ background: "linear-gradient(135deg, #10b981, #14b8a6)" }}
        >
          <Upload className="w-4 h-4" />
          导入员工
        </button>
      </header>

      <main className="px-8 pb-8">
        {isLoading ? (
          <div className="glass-card p-12 text-center text-gray-400">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {userList?.map((member, idx) => {
              const ms = getMemberStats(member.id);
              const efficiency = ms && ms.total > 0
                ? Math.round((ms.done / ms.total) * 100)
                : 0;
              return (
                <div
                  key={member.id}
                  className="glass-card p-6 animate-float-in group"
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    {/* Avatar with edit button */}
                    <div
                      className="relative cursor-pointer"
                      onClick={() =>
                        setEditingAvatar({
                          id: member.id,
                          name: member.name ?? "",
                          avatar: member.avatar,
                        })
                      }
                    >
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name ?? ""}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-white/50"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold ring-2 ring-white/50">
                          {(member.name ?? "U")[0]}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <Pencil className="w-3 h-3 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {member.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            member.role === "admin"
                              ? "text-amber-700 bg-amber-50"
                              : "text-gray-600 bg-gray-100"
                          }`}
                        >
                          {member.role === "admin" ? "管理员" : "成员"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {ms?.total ?? 0} 个任务
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">已完成</span>
                      <span className="font-semibold text-emerald-600">{ms?.done ?? 0}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
                        style={{ width: `${efficiency}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-gray-500">进行中</span>
                      <span className="font-semibold text-blue-600">{ms?.inProgress ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">待处理</span>
                      <span className="font-semibold text-red-500">{ms?.todo ?? 0}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100/60 flex items-center justify-between">
                    <span className="text-sm text-gray-400">效率评分</span>
                    <span
                      className={`text-lg font-bold ${
                        efficiency >= 80 ? "text-emerald-500" : efficiency >= 60 ? "text-blue-500" : "text-amber-500"
                      }`}
                    >
                      {efficiency}%
                    </span>
                  </div>
                </div>
              );
            }) ?? (
              <div className="col-span-full glass-card p-12 text-center text-gray-400">
                暂无团队成员数据
              </div>
            )}
          </div>
        )}
      </main>

      <EmployeeImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      {editingAvatar && (
        <AvatarEditor
          currentAvatar={editingAvatar.avatar}
          name={editingAvatar.name}
          userId={editingAvatar.id}
          onSave={() => {
            utils.user.list.invalidate();
            utils.stats.dashboard.invalidate();
          }}
          onClose={() => setEditingAvatar(null)}
        />
      )}
    </>
  );
}

/* ─────────────────────── Settings ─────────────────────── */
function SettingsPage() {
  return (
    <>
      <header className="flex items-center justify-between h-[72px] px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">设置</h1>
          <p className="text-sm text-gray-500">管理您的账户和偏好</p>
        </div>
      </header>

      <main className="px-8 pb-8 max-w-2xl">
        <div className="glass-card p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">通知设置</h3>
            <p className="text-sm text-gray-500 mb-4">配置您接收通知的方式</p>
            <div className="space-y-3">
              {["任务分配通知", "状态变更通知", "截止日期提醒"].map((label) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100/40 last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button className="w-11 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 relative transition-all duration-200">
                    <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100/60">
            <h3 className="text-lg font-bold text-gray-900 mb-1">界面偏好</h3>
            <p className="text-sm text-gray-500 mb-4">自定义您的工作区外观</p>
            <div className="space-y-3">
              {["紧凑模式", "显示已完成任务"].map((label) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100/40 last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button className="w-11 h-6 rounded-full bg-gray-200 relative transition-all duration-200">
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ─────────────────────── Home ─────────────────────── */
export default function Home() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[260px] flex flex-col min-h-screen">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
