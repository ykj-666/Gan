import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { tasks, users } from "@db/schema";

export const statsRouter = createRouter({
  dashboard: publicQuery.query(async () => {
    const db = getDb();

    const allTasks = await db.select().from(tasks);
    const allUsers = await db.select().from(users);

    const todoCount = allTasks.filter((t) => t.status === "todo").length;
    const inProgressCount = allTasks.filter(
      (t) => t.status === "in_progress"
    ).length;
    const reviewCount = allTasks.filter((t) => t.status === "review").length;
    const doneCount = allTasks.filter((t) => t.status === "done").length;
    const totalCount = allTasks.length;

    const completionRate =
      totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const urgentCount = allTasks.filter(
      (t) => t.priority === "urgent"
    ).length;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekTasks = allTasks.filter(
      (t) => t.createdAt && new Date(t.createdAt) >= weekAgo
    ).length;

    const memberStats = allUsers.map((user) => {
      const userTasks = allTasks.filter((t) => t.assigneeId === user.id);
      return {
        id: user.id,
        name: user.name ?? "未命名",
        avatar: user.avatar,
        total: userTasks.length,
        done: userTasks.filter((t) => t.status === "done").length,
        inProgress: userTasks.filter((t) => t.status === "in_progress").length,
        todo: userTasks.filter((t) => t.status === "todo").length,
      };
    });

    return {
      overview: {
        total: totalCount,
        todo: todoCount,
        inProgress: inProgressCount,
        review: reviewCount,
        done: doneCount,
        urgent: urgentCount,
        completionRate,
        thisWeekNew: thisWeekTasks,
      },
      memberStats,
    };
  }),
});
