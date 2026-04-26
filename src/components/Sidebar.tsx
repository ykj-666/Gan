import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  ChevronRight,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "仪表盘", path: "/" },
  { icon: AlertTriangle, label: "异常工作台", path: "/exceptions" },
  { icon: ListTodo, label: "任务看板", path: "/board" },
  { icon: Users, label: "员工管理", path: "/team" },
  { icon: CalendarCheck, label: "考勤管理", path: "/attendance" },
  { icon: FileSpreadsheet, label: "报表中心", path: "/reports" },
  { icon: History, label: "操作日志", path: "/logs" },
  { icon: Settings, label: "设置", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col border-r border-gray-800 bg-gray-900">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">工作安排管理</h1>
            <p className="text-[11px] text-gray-500">管理端后台</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] transition-transform duration-200 ${
                  isActive ? "scale-110" : "group-hover:scale-105"
                }`}
              />
              <span>{item.label}</span>
              {isActive ? <ChevronRight className="ml-auto h-4 w-4 opacity-60" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 px-3 pb-5 pt-4">
        <div className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-3 py-2.5">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name ?? "User"}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-700"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-2 ring-gray-700">
              {(user?.name ?? "U")[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-200">
              {user?.name ?? "管理员"}
            </p>
            <p className="truncate text-[11px] text-gray-500">
              {user?.role === "admin" ? "管理员" : "用户"}
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-gray-500 transition-all duration-200 hover:bg-gray-700 hover:text-gray-300"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
