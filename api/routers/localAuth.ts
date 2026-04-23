import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { env } from "../lib/env";
import { TRPCError } from "@trpc/server";

const JWT_ALG = "HS256";
const JWT_SECRET = () => new TextEncoder().encode(env.appSecret + "_local");

async function signLocalToken(payload: { userId: number; username: string }) {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
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

export const localAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: z.string().min(2).max(50),
        email: z.string().email().optional(),
        password: z.string().min(6).max(100),
        name: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if username already exists
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

      const result = await db.insert(users).values({
        unionId,
        name: input.name,
        email: input.email,
        passwordHash,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.username)}`,
        role: "user",
      });

      const userId = Number(result[0].insertId);
      const token = await signLocalToken({ userId, username: input.username });

      return {
        token,
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
      })
    )
    .mutation(async ({ input }) => {
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

      // Update last sign in
      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const token = await signLocalToken({
        userId: user.id,
        username: input.username,
      });

      return {
        token,
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
    const token = ctx.req.headers.get("x-local-auth-token");
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
});
