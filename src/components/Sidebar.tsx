import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Settings,
  LogOut,
  Sparkles,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "仪表盘", path: "/" },
  { icon: ListTodo, label: "任务看板", path: "/board" },
  { icon: Users, label: "团队成员", path: "/team" },
  { icon: FileSpreadsheet, label: "考勤管理", path: "/attendance" },
  { icon: Settings, label: "设置", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] flex flex-col z-50"
      style={{
        background: "linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)",
        borderRadius: "0 24px 24px 0",
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">
              速派任务
            </h1>
            <p className="text-white/50 text-xs">高效协作平台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-white/15 text-white shadow-lg shadow-black/10"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] transition-transform duration-200 ${
                  isActive ? "scale-110" : "group-hover:scale-105"
                }`}
              />
              <span>{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 pb-6 pt-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/8">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name ?? "User"}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white/20">
              {(user?.name ?? "U")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {user?.name ?? "用户"}
            </p>
            <p className="text-white/40 text-xs truncate">
              {user?.role === "admin" ? "管理员" : "成员"}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all duration-200"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
