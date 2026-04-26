import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const userRoleEnum = ["user", "admin"] as const;
const taskStatusEnum = ["todo", "in_progress", "review", "done"] as const;
const taskPriorityEnum = ["low", "medium", "high", "urgent"] as const;
const activityTypeEnum = [
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
] as const;
const attendanceTypeEnum = [
  "sick",
  "annual",
  "personal",
  "marriage",
  "maternity",
  "other",
] as const;
const attendanceStatusEnum = ["pending", "approved", "rejected"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  department: varchar("department", { length: 255 }),
  email: varchar("email", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", userRoleEnum).default("user").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().onUpdateNow().notNull(),
  lastSignInAt: timestamp("lastSignInAt", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deletedAt", { mode: "date" }),
}, (table) => [
  index("users_role_idx").on(table.role),
  index("users_department_idx").on(table.department),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 191 }).primaryKey(),
  value: text("value").notNull(),
  isEncrypted: boolean("is_encrypted").default(false).notNull(),
  updatedBy: int("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  projectCode: varchar("projectCode", { length: 255 }),
  projectType: varchar("projectType", { length: 255 }),
  specialty: varchar("specialty", { length: 255 }),
  projectManagerId: int("projectManagerId").references(() => users.id, { onDelete: "set null" }),
  assigneeId: int("assigneeId").references(() => users.id, { onDelete: "set null" }),
  status: mysqlEnum("status", taskStatusEnum).default("todo").notNull(),
  priority: mysqlEnum("priority", taskPriorityEnum).default("medium").notNull(),
  plannedStartDate: varchar("plannedStartDate", { length: 10 }),
  plannedEndDate: varchar("plannedEndDate", { length: 10 }),
  estimatedHours: int("estimatedHours"),
  remark: text("remark"),
  creatorId: int("creatorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt", { mode: "date" }),
}, (table) => [
  index("tasks_status_idx").on(table.status),
  index("tasks_priority_idx").on(table.priority),
  index("tasks_assignee_idx").on(table.assigneeId),
  index("tasks_creator_idx").on(table.creatorId),
  index("tasks_project_manager_idx").on(table.projectManagerId),
]);

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", activityTypeEnum).notNull(),
  description: text("description").notNull(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  taskId: int("taskId").references(() => tasks.id, { onDelete: "set null" }),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  ipAddress: varchar("ip_address", { length: 255 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deletedAt", { mode: "date" }),
}, (table) => [
  index("activities_type_idx").on(table.type),
  index("activities_user_idx").on(table.userId),
  index("activities_task_idx").on(table.taskId),
  index("activities_created_at_idx").on(table.createdAt),
]);

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export const attendances = mysqlTable("attendances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", attendanceTypeEnum).default("other").notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }).notNull(),
  days: int("days"),
  reason: text("reason"),
  status: mysqlEnum("status", attendanceStatusEnum).default("approved").notNull(),
  approvedBy: int("approvedBy").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approvedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt", { mode: "date" }),
}, (table) => [
  index("attendances_user_idx").on(table.userId),
  index("attendances_status_idx").on(table.status),
  index("attendances_start_date_idx").on(table.startDate),
]);

export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;

export const businessTrips = mysqlTable("business_trip", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
  employeeName: varchar("employee_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 255 }).notNull(),
  projectCode: varchar("project_code", { length: 255 }).notNull(),
  cycleStart: varchar("cycle_start", { length: 10 }).notNull(),
  cycleEnd: varchar("cycle_end", { length: 10 }).notNull(),
  dispatchStart: varchar("dispatch_start", { length: 10 }).notNull().default(""),
  dispatchEnd: varchar("dispatch_end", { length: 10 }).notNull().default(""),
  location: varchar("location", { length: 255 }).notNull(),
  workDays: int("work_days").notNull(),
  actualDays: int("actual_days").notNull(),
  officeDays: int("office_days").notNull(),
  tripDays: int("trip_days").notNull(),
  tempDays: int("temp_days").notNull(),
  absenceDays: int("absence_days").notNull(),
  absenceReason: text("absence_reason"),
  subsidyDays: int("subsidy_days").notNull(),
  remark: text("remark"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
}, (table) => [
  index("business_trip_user_id_idx").on(table.userId),
  index("business_trip_department_idx").on(table.department),
  index("business_trip_cycle_start_idx").on(table.cycleStart),
]);

export type BusinessTrip = typeof businessTrips.$inferSelect;
export type InsertBusinessTrip = typeof businessTrips.$inferInsert;
