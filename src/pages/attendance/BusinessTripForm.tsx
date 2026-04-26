import type { TripDraft, UserOption } from "./helpers";

export type BusinessTripRecord = {
  id: number;
  userId: number | null;
  employeeName: string;
  department: string;
  projectName: string | null;
  projectCode: string;
  cycleStart: string;
  cycleEnd: string;
  dispatchStart: string;
  dispatchEnd: string;
  location: string;
  workDays: number;
  actualDays: number;
  officeDays: number;
  tripDays: number;
  tempDays: number;
  absenceDays: number;
  absenceReason: string | null;
  subsidyDays: number;
  remark: string | null;
};

export function TripMetrics({ trip }: { trip: TripDraft }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {[
        { label: "应出勤", value: trip.workDays },
        { label: "办公区", value: trip.officeDays },
        { label: "长期出差", value: trip.tripDays },
        { label: "临时外派", value: trip.tempDays },
        { label: "补贴天数", value: trip.subsidyDays },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-center"
        >
          <p className="text-[11px] text-gray-500">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 sm:text-base">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TripFormFields({
  trip,
  onChange,
  users,
  tasks,
  showCycleMonth = true,
}: {
  trip: TripDraft;
  onChange: <K extends keyof TripDraft>(field: K, value: TripDraft[K]) => void;
  users: UserOption[];
  tasks: Array<{ projectName: string; projectCode: string | null }>;
  showCycleMonth?: boolean;
}) {
  const taskOptions = tasks.filter((task) => task.projectCode?.trim());

  return (
    <div className="space-y-4">
      {showCycleMonth ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">考勤周期</label>
          <input
            type="month"
            value={trip.cycleMonth}
            onChange={(event) => onChange("cycleMonth", event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-1 text-xs text-gray-500">
            固定周期：{trip.cycleStart} - {trip.cycleEnd}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">员工姓名</label>
          <select
            value={trip.userId}
            onChange={(event) => {
              const nextUserId = Number(event.target.value) || "";
              const selectedUser = users.find((user) => user.id === nextUserId);
              onChange("userId", nextUserId);
              if (selectedUser?.name) {
                onChange("employeeName", selectedUser.name);
              }
              if (selectedUser?.department) {
                onChange("department", selectedUser.department);
              }
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">请选择员工</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || `用户-${user.id}`}
              </option>
            ))}
          </select>
          {trip.employeeName ? (
            <p className="mt-1 text-xs text-gray-500">识别姓名：{trip.employeeName}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">部门</label>
          <input
            value={trip.department}
            onChange={(event) => onChange("department", event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">项目编号</label>
          <input
            list="trip-project-code-options"
            value={trip.projectCode}
            onChange={(event) => {
              const nextCode = event.target.value;
              const matchedTask = taskOptions.find((task) => task.projectCode === nextCode);
              onChange("projectCode", nextCode);
              onChange("projectName", matchedTask?.projectName ?? "");
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <datalist id="trip-project-code-options">
            {taskOptions.map((task) => (
              <option key={`${task.projectCode}-${task.projectName}`} value={task.projectCode ?? ""}>
                {task.projectName}
              </option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">项目名称</label>
          <input
            readOnly
            value={trip.projectName}
            placeholder="根据项目编号自动联动"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">出差地点</label>
          <input
            value={trip.location}
            onChange={(event) => onChange("location", event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">派遣起始日</label>
          <input
            type="date"
            value={trip.dispatchStart}
            onChange={(event) => onChange("dispatchStart", event.target.value)}
            className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">派遣结束日</label>
          <input
            type="date"
            value={trip.dispatchEnd}
            onChange={(event) => onChange("dispatchEnd", event.target.value)}
            className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">本月应出勤天数</label>
          <input
            type="number"
            min={0}
            value={trip.workDays}
            onChange={(event) => onChange("workDays", Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">办公区天数</label>
          <input
            type="number"
            min={0}
            value={trip.officeDays}
            onChange={(event) => onChange("officeDays", Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">长期出差天数</label>
          <input
            type="number"
            min={0}
            value={trip.tripDays}
            onChange={(event) => onChange("tripDays", Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">临时外派天数</label>
          <input
            type="number"
            min={0}
            value={trip.tempDays}
            onChange={(event) => onChange("tempDays", Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">缺勤天数</label>
          <input
            readOnly
            value={trip.absenceDays}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">实际出勤合计</label>
          <input
            readOnly
            value={trip.actualDays}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">缺勤原因</label>
          <input
            value={trip.absenceReason}
            onChange={(event) => onChange("absenceReason", event.target.value)}
            placeholder="年假 / 事假 / 病假 / 产假等"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">出差补贴天数</label>
          <input
            type="number"
            min={0}
            value={trip.subsidyDays}
            onChange={(event) => onChange("subsidyDays", Number(event.target.value) || 0)}
            className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">备注</label>
        <textarea
          rows={3}
          value={trip.remark}
          onChange={(event) => onChange("remark", event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
    </div>
  );
}
