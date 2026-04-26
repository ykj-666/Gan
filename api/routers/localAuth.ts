import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { env } from "../lib/env";
import { TRPCError } from "@trpc/server";
import { getCookieValue, serializeCookie } from "../lib/cookie";

const JWT_ALG = "HS256";
const JWT_SECRET = () => new TextEncoder().encode(env.appSecret + "_local");

async function signLocalToken(payload: { userId: number; username: string }) {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET());
}

export async function verifyLocalToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET(), {
      algorithms: [JWT_ALG],
      clockTolerance: 60,
    });
    return payload as unknown as { userId: number; username: string };
  } catch {
    return null;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};

function setAuthCookie(resHeaders: Headers, token: string) {
  resHeaders.append("Set-Cookie", serializeCookie("local_auth_token", token, COOKIE_OPTIONS));
}

function clearAuthCookie(resHeaders: Headers) {
  resHeaders.append(
    "Set-Cookie",
    serializeCookie("local_auth_token", "", { ...COOKIE_OPTIONS, maxAge: 0 }),
  );
}

const loginAttempts = new Map<string, { count: number; resetTime: number }>();

function checkLoginRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetTime) {
    loginAttempts.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  record.count++;
  return record.count <= maxAttempts;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: z.string().min(2).max(50),
        email: z.string().email().optional(),
        password: z
          .string()
          .min(8, "密码至少需要 8 位")
          .max(100)
          .regex(/^(?=.*[A-Za-z])(?=.*\d)/, "密码必须同时包含字母和数字"),
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      const rateKey = `register:${input.username}:${clientIp}`;
      if (!checkLoginRateLimit(rateKey, 3, 60 * 60 * 1000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "注册尝试过多，请稍后再试",
        });
      }

      const db = getDb();

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.unionId, `local_${input.username}`))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "用户名已被使用",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const unionId = `local_${input.username}`;

      const [inserted] = await db.insert(users).values({
        unionId,
        name: input.name,
        email: input.email,
        passwordHash,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.username)}`,
        role: "user",
      }).$returningId();

      if (!inserted?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败，请稍后重试" });
      }

      const userId = inserted.id;
      const token = await signLocalToken({ userId, username: input.username });
      setAuthCookie(ctx.resHeaders, token);

      return {
        user: {
          id: userId,
          name: input.name,
          username: input.username,
          email: input.email,
          role: "user" as const,
        },
      };
    }),

  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);
      const rateKey = `login:${input.username}:${clientIp}`;
      if (!checkLoginRateLimit(rateKey, 5, 15 * 60 * 1000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "登录尝试过多，请 15 分钟后再试",
        });
      }

      const db = getDb();
      const unionId = `local_${input.username}`;

      const rows = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      const user = rows[0];
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const token = await signLocalToken({
        userId: user.id,
        username: input.username,
      });
      setAuthCookie(ctx.resHeaders, token);

      return {
        user: {
          id: user.id,
          name: user.name,
          username: input.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const token = getCookieValue(ctx.req, "local_auth_token");
    if (!token) return null;

    const claim = await verifyLocalToken(token);
    if (!claim) return null;

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, claim.userId))
      .limit(1);

    const user = rows[0];
    if (!user) return null;

    return {
      id: user.id,
      unionId: user.unionId,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
    };
  }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    clearAuthCookie(ctx.resHeaders);
    return { success: true };
  }),
});
