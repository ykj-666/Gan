import { Navigate, Outlet } from "react-router";
import { Menu } from "lucide-react";
import { Sidebar, SidebarBrand, SidebarNav, SidebarUserCard, navItems } from "@/components/Sidebar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LOGIN_PATH } from "@/const";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo, useState } from "react";
import { useLocation } from "react-router";

function getCurrentPageTitle(pathname: string) {
  const matched = navItems.find((item) =>
    item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  return matched?.label ?? "工作安排管理";
}

export function AdminShell() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = useMemo(() => getCurrentPageTitle(location.pathname), [location.pathname]);

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
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {isMobile ? (
        <>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700"
              aria-label="打开导航菜单"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{pageTitle}</p>
            </div>
          </header>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-[280px] border-r-0 bg-gray-900 p-0 text-white">
              <SheetHeader className="sr-only">
                <SheetTitle>导航菜单</SheetTitle>
                <SheetDescription>移动端页面导航</SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <SidebarBrand compact />
                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
                <SidebarUserCard />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col md:ml-[240px]">
        <main className="min-h-screen overflow-x-hidden px-4 py-4 md:px-6 md:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
