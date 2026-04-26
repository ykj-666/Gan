import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { RouteLoading } from "@/components/RouteLoading";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoading label="应用加载中..." />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
