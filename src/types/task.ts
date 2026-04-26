import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type TaskListItem = RouterOutputs["task"]["list"][number];
