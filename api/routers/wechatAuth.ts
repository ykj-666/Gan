import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import * as jose from "jose";
import { env } from "../lib/env";
import { TRPCError } from "@trpc/server";
import { getCookieValue, serializeCookie } from "../lib/cookie";

const JWT_ALG = "HS256";
const JWT_SECRET = () => new TextEncoder().encode(env.appSecret + "_wechat");

async function signWechatToken(payload: { unionId: string; openid: string }) {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET());
}

export async function verifyWechatToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET(), {
      algorithms: [JWT_ALG],
      clockTolerance: 60,
    });
    return payload as unknown as { unionId: string; openid: string };
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
  resHeaders.append("Set-Cookie", serializeCookie("wechat_auth_token", token, COOKIE_OPTIONS));
}

function clearAuthCookie(resHeaders: Headers) {
  resHeaders.append(
    "Set-Cookie",
    serializeCookie("wechat_auth_token", "", { ...COOKIE_OPTIONS, maxAge: 0 }),
  );
}

// WeChat config from env
function getWechatConfig() {
  return {
    appId: process.env.WECHAT_APP_ID ?? "",
    appSecret: process.env.WECHAT_APP_SECRET ?? "",
    enabled: !!(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET),
  };
}

export const wechatAuthRouter = createRouter({
  // Get WeChat QR code authorization URL
  getAuthUrl: publicQuery.query(() => {
    const config = getWechatConfig();
    const redirectUri = encodeURIComponent(
      `${env.isProduction ? "https://your-domain.com" : "http://localhost:3000"}/api/oauth/wechat/callback`
    );

    // WeChat Web OAuth URL for QR code scanning
    const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${config.appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${Date.now()}#wechat_redirect`;

    return {
      url,
      enabled: config.enabled,
      // If WeChat is not configured, return a mock URL for development
      mockMode: !config.enabled,
    };
  }),

  // Mock login for development (when WeChat credentials are not available)
  mockLogin: publicQuery
    .input(
      z.object({
        nickname: z.string().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const mockOpenid = `mock_wechat_${Date.now()}`;
      const unionId = `wechat_${mockOpenid}`;

      // Check if user exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      let userId: number;

      if (existing[0]) {
        userId = existing[0].id;
        // Update last sign in
        await db
          .update(users)
          .set({ lastSignInAt: new Date() })
          .where(eq(users.id, userId));
      } else {
        // Create new user
        const result = await db.insert(users).values({
          unionId,
          name: input.nickname || `微信用户${Date.now().toString().slice(-6)}`,
          avatar:
            input.avatar ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockOpenid}`,
          role: "user",
        });
        userId = Number(result.lastInsertRowid);
      }

      const token = await signWechatToken({ unionId, openid: mockOpenid });
      setAuthCookie(ctx.resHeaders, token);

      return {
        user: {
          id: userId,
          name: input.nickname || `微信用户${Date.now().toString().slice(-6)}`,
          avatar: input.avatar,
          role: "user" as const,
        },
      };
    }),

  // Exchange code for token (called by frontend after WeChat callback)
  exchangeCode: publicQuery
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const config = getWechatConfig();

      if (!config.enabled) {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "WeChat login not configured",
        });
      }

      // Step 1: Exchange code for access_token
      const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appId}&secret=${config.appSecret}&code=${input.code}&grant_type=authorization_code`;

      const tokenResp = await fetch(tokenUrl);
      const tokenData = (await tokenResp.json()) as {
        access_token?: string;
        openid?: string;
        unionid?: string;
        errcode?: number;
        errmsg?: string;
      };

      if (tokenData.errcode) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: tokenData.errmsg || "WeChat authorization failed",
        });
      }

      if (!tokenData.access_token || !tokenData.openid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Failed to get WeChat access token",
        });
      }

      // Step 2: Get user info
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`;

      const userResp = await fetch(userInfoUrl);
      const userData = (await userResp.json()) as {
        openid?: string;
        nickname?: string;
        headimgurl?: string;
        unionid?: string;
        errcode?: number;
        errmsg?: string;
      };

      if (userData.errcode) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: userData.errmsg || "Failed to get WeChat user info",
        });
      }

      // Step 3: Upsert user in database
      const db = getDb();
      const unionId = userData.unionid
        ? `wechat_${userData.unionid}`
        : `wechat_${userData.openid}`;

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      let userId: number;

      if (existing[0]) {
        userId = existing[0].id;
        await db
          .update(users)
          .set({
            lastSignInAt: new Date(),
            name: userData.nickname || existing[0].name,
            avatar: userData.headimgurl || existing[0].avatar,
          })
          .where(eq(users.id, userId));
      } else {
        const result = await db.insert(users).values({
          unionId,
          name: userData.nickname || `微信用户${Date.now().toString().slice(-6)}`,
          avatar: userData.headimgurl,
          role: "user",
        });
        userId = Number(result.lastInsertRowid);
      }

      const token = await signWechatToken({
        unionId,
        openid: userData.openid!,
      });
      setAuthCookie(ctx.resHeaders, token);

      return {
        user: {
          id: userId,
          name: userData.nickname || "微信用户",
          avatar: userData.headimgurl,
          role: "user" as const,
        },
      };
    }),

  // Verify token and return user (used by frontend to check auth state)
  me: publicQuery.query(async ({ ctx }) => {
    const token = getCookieValue(ctx.req, "wechat_auth_token");
    if (!token) return null;

    const claim = await verifyWechatToken(token);
    if (!claim) return null;

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.unionId, claim.unionId))
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
