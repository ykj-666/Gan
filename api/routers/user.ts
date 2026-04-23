import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq, like, desc, and } from "drizzle-orm";

export const userRouter = createRouter({
  list: publicQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          role: z.enum(["user", "admin"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];

      if (input?.search) {
        conditions.push(like(users.name, `%${input.search}%`));
      }
      if (input?.role) {
        conditions.push(eq(users.role, input.role));
      }

      if (conditions.length > 0) {
        return db
          .select()
          .from(users)
          .where(and(...conditions))
          .orderBy(desc(users.createdAt));
      }

      return db.select().from(users).orderBy(desc(users.createdAt));
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);
      return result[0] ?? null;
    }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        avatar: z.string().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const unionId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await db.insert(users).values({
        unionId,
        name: input.name,
        email: input.email,
        avatar:
          input.avatar ??
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`,
        role: input.role,
      });

      return {
        id: Number(result[0].insertId),
        ...input,
        unionId,
      };
    }),

  batchCreate: authedQuery
    .input(
      z.array(
        z.object({
          name: z.string().min(1),
          email: z.string().email().optional(),
          role: z.enum(["user", "admin"]).optional().default("user"),
        })
      )
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const results = [];

      for (const userData of input) {
        const unionId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        const result = await db.insert(users).values({
          unionId,
          name: userData.name,
          email: userData.email,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.name)}`,
          role: userData.role ?? "user",
        });

        results.push({
          id: Number(result[0].insertId),
          ...userData,
          unionId,
        });
      }

      return { count: results.length, users: results };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined) updateData.role = data.role;

      await db.update(users).set(updateData).where(eq(users.id, id));

      return { id, ...data };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),

  updateAvatar: authedQuery
    .input(z.object({ id: z.number(), avatar: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({ avatar: input.avatar })
        .where(eq(users.id, input.id));
      return { id: input.id, avatar: input.avatar };
    }),

  generateAvatar: publicQuery
    .input(z.object({ prompt: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const encodedPrompt = encodeURIComponent(input.prompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=400&nologo=true&seed=${Date.now()}&enhance=true`;

        const resp = await fetch(url, { timeout: 30000 } as RequestInit);
        if (!resp.ok) throw new Error("Generation failed");

        const buffer = Buffer.from(await resp.arrayBuffer());
        const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

        return { url: base64 };
      } catch {
        return { url: null };
      }
    }),
});
