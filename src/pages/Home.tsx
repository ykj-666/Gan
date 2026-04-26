import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { AdminShell } from "./home/AdminShell";

const AttendancePage = lazy(() => import("./Attendance"));
const BoardPage = lazy(() =>
  import("./home/BoardPage").then((module) => ({ default: module.BoardPage })),
);
const DashboardPage = lazy(() =>
  import("./home/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ExceptionsPage = lazy(() =>
  import("./home/ExceptionsPage").then((module) => ({
    default: module.ExceptionsPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./home/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const ActivityLogsPage = lazy(() =>
  import("./home/ActivityLogsPage").then((module) => ({
    default: module.ActivityLogsPage,
  })),
);
const SearchPage = lazy(() =>
  import("./home/SearchPage").then((module) => ({
    default: module.SearchPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./home/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const TeamPage = lazy(() =>
  import("./home/TeamPage").then((module) => ({ default: module.TeamPage })),
);

export default function Home() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route element={<AdminShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="logs" element={<ActivityLogsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
