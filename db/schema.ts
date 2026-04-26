import {
  sqliteTable,
  integer,
  text,
  index,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  unionId: text("unionId").notNull().unique(),
  name: text("name"),
  department: text("department"),
  email: text("email"),
  avatar: text("avatar"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  passwordHash: text("passwordHash"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
  lastSignInAt: integer("lastSignInAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
}, (table) => [
  index("users_role_idx").on(table.role),
  index("users_department_idx").on(table.department),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const tasks = sqliteTable("tasks", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectName: text("projectName").notNull(),
  projectCode: text("projectCode"),
  projectType: text("projectType"),
  specialty: text("specialty"),
  projectManagerId: integer("projectManagerId", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  assigneeId: integer("assigneeId", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ["todo", "in_progress", "review", "done"] })
    .default("todo")
    .notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .default("medium")
    .notNull(),
  plannedStartDate: text("plannedStartDate"),
  plannedEndDate: text("plannedEndDate"),
  estimatedHours: integer("estimatedHours", { mode: "number" }),
  remark: text("remark"),
  creatorId: integer("creatorId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
}, (table) => [
  index("tasks_status_idx").on(table.status),
  index("tasks_priority_idx").on(table.priority),
  index("tasks_assignee_idx").on(table.assigneeId),
  index("tasks_creator_idx").on(table.creatorId),
  index("tasks_project_manager_idx").on(table.projectManagerId),
]);

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const activities = sqliteTable("activities", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  type: text("type", {
    enum: [
      "task_created",
      "task_updated",
      "task_assigned",
      "task_completed",
      "task_deleted",
      "status_changed",
      "user_created",
      "user_updated",
      "user_deleted",
      "user_imported",
      "leave_created",
      "leave_deleted",
      "leave_status_changed",
      "trip_created",
      "trip_updated",
      "trip_deleted",
      "trip_imported",
    ],
  }).notNull(),
  description: text("description").notNull(),
  userId: integer("userId", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  taskId: integer("taskId", { mode: "number" }).references(() => tasks.id, { onDelete: "set null" }),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
}, (table) => [
  index("activities_type_idx").on(table.type),
  index("activities_user_idx").on(table.userId),
  index("activities_task_idx").on(table.taskId),
  index("activities_created_at_idx").on(table.createdAt),
]);

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export const attendances = sqliteTable("attendances", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["sick", "annual", "personal", "marriage", "maternity", "other"] })
    .default("other")
    .notNull(),
  startDate: text("startDate").notNull(),
  endDate: text("endDate").notNull(),
  days: integer("days", { mode: "number" }),
  reason: text("reason"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("approved")
    .notNull(),
  approvedBy: integer("approvedBy", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  approvedAt: integer("approvedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
  deletedAt: integer("deletedAt", { mode: "timestamp" }),
}, (table) => [
  index("attendances_user_idx").on(table.userId),
  index("attendances_status_idx").on(table.status),
  index("attendances_start_date_idx").on(table.startDate),
]);

export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;

export const businessTrips = sqliteTable("business_trip", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  employeeName: text("employee_name").notNull(),
  department: text("department").notNull(),
  projectCode: text("project_code").notNull(),
  cycleStart: text("cycle_start").notNull(),
  cycleEnd: text("cycle_end").notNull(),
  dispatchStart: text("dispatch_start").notNull(),
  dispatchEnd: text("dispatch_end").notNull(),
  location: text("location").notNull(),
  workDays: integer("work_days", { mode: "number" }).notNull(),
  actualDays: integer("actual_days", { mode: "number" }).notNull(),
  officeDays: integer("office_days", { mode: "number" }).notNull(),
  tripDays: integer("trip_days", { mode: "number" }).notNull(),
  tempDays: integer("temp_days", { mode: "number" }).notNull(),
  absenceDays: integer("absence_days", { mode: "number" }).notNull(),
  absenceReason: text("absence_reason"),
  subsidyDays: integer("subsidy_days", { mode: "number" }).notNull(),
  remark: text("remark"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
}, (table) => [
  index("business_trip_user_id_idx").on(table.userId),
  index("business_trip_department_idx").on(table.department),
  index("business_trip_cycle_start_idx").on(table.cycleStart),
]);

export type BusinessTrip = typeof businessTrips.$inferSelect;
export type InsertBusinessTrip = typeof businessTrips.$inferInsert;
