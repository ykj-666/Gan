import { authRouter } from "./auth-router";
import { taskRouter } from "./routers/task";
import { activityRouter } from "./routers/activity";
import { statsRouter } from "./routers/stats";
import { userRouter } from "./routers/user";
import { localAuthRouter } from "./routers/localAuth";
import { wechatAuthRouter } from "./routers/wechatAuth";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  wechatAuth: wechatAuthRouter,
  task: taskRouter,
  activity: activityRouter,
  stats: statsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
