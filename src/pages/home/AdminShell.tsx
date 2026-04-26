import { Navigate, Outlet } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import { LOGIN_PATH } from "@/const";
import { useAuth } from "@/hooks/useAuth";

export function AdminShell() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="ml-[240px] flex min-h-screen flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
