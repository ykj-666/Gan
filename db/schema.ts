import {
  sqliteTable,
  integer,
  text,
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
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const tasks = sqliteTable("tasks", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  projectName: text("projectName").notNull(),
  projectCode: text("projectCode"),
  projectType: text("projectType"),
  specialty: text("specialty"),
  projectManagerId: integer("projectManagerId", { mode: "number" }),
  assigneeId: integer("assigneeId", { mode: "number" }),
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
  creatorId: integer("creatorId", { mode: "number" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
});

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
  userId: integer("userId", { mode: "number" }),
  taskId: integer("taskId", { mode: "number" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export const attendances = sqliteTable("attendances", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("userId", { mode: "number" }).notNull(),
  type: text("type", { enum: ["sick", "annual", "personal", "marriage", "maternity", "other"] })
    .default("other")
    .notNull(),
  startDate: text("startDate").notNull(), // YYYY-MM-DD
  endDate: text("endDate").notNull(),     // YYYY-MM-DD
  days: integer("days", { mode: "number" }),
  reason: text("reason"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("approved")
    .notNull(),
  approvedBy: integer("approvedBy", { mode: "number" }),
  approvedAt: integer("approvedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
});

export type Attendance = typeof attendances.$inferSelect;
export type InsertAttendance = typeof attendances.$inferInsert;

export const businessTrips = sqliteTable("business_trip", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }),
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
});

export type BusinessTrip = typeof businessTrips.$inferSelect;
export type InsertBusinessTrip = typeof businessTrips.$inferInsert;
