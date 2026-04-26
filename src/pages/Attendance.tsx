import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Building2, CalendarCheck, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaveManagementSection } from "./attendance/LeaveManagementSection";
import { BusinessTripSection } from "./attendance/BusinessTripSection";

export default function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [moduleTab, setModuleTab] = useState(
    searchParams.get("tab") === "trip" ? "trip" : "leave",
  );

  useEffect(() => {
    setModuleTab(searchParams.get("tab") === "trip" ? "trip" : "leave");
  }, [searchParams]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-500">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm">考勤管理</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">
              请假与出差考勤
            </h1>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              请假管理与出差考勤统一收敛到同一页面，但保留各自模块能力。
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={moduleTab}
        onValueChange={(value) => {
          setModuleTab(value);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("tab", value);
          setSearchParams(nextParams, { replace: true });
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-white p-1 shadow-sm sm:max-w-[420px]">
          <TabsTrigger
            value="leave"
            className="gap-2 px-2 py-3 text-xs sm:px-3 sm:text-sm"
          >
            <CalendarCheck className="h-4 w-4" />
            请假管理
          </TabsTrigger>
          <TabsTrigger
            value="trip"
            className="gap-2 px-2 py-3 text-xs sm:px-3 sm:text-sm"
          >
            <Building2 className="h-4 w-4" />
            出差考勤
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="mt-4 sm:mt-5">
          <LeaveManagementSection />
        </TabsContent>

        <TabsContent value="trip" className="mt-4 sm:mt-5">
          <BusinessTripSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
