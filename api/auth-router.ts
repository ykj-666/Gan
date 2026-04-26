import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { serializeCookie } from "./lib/cookie";
import { env } from "./lib/env";

const clearCookieOpts = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "Strict" as const,
  path: "/",
  maxAge: 0,
};

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    // Also clear local and WeChat auth cookies
    ctx.resHeaders.append("Set-Cookie", serializeCookie("local_auth_token", "", clearCookieOpts));
    ctx.resHeaders.append("Set-Cookie", serializeCookie("wechat_auth_token", "", clearCookieOpts));
    return { success: true };
  }),
});
