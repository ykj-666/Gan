import { relations } from "drizzle-orm";
import {
  activities,
  attendances,
  businessTrips,
  tasks,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: "taskCreator" }),
  managedTasks: many(tasks, { relationName: "taskManager" }),
  assignedTasks: many(tasks, { relationName: "taskAssignee" }),
  attendances: many(attendances),
  businessTrips: many(businessTrips),
  activities: many(activities),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
    relationName: "taskCreator",
  }),
  projectManager: one(users, {
    fields: [tasks.projectManagerId],
    references: [users.id],
    relationName: "taskManager",
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  user: one(users, {
    fields: [attendances.userId],
    references: [users.id],
  }),
}));

export const businessTripsRelations = relations(businessTrips, ({ one }) => ({
  user: one(users, {
    fields: [businessTrips.userId],
    references: [users.id],
  }),
}));
