import { and, desc, eq, like, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { users } from "@db/schema";
import { createActivity } from "../lib/activity";
import { createRouter, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";

export const userRouter = createRouter({
  list: adminQuery
    .input(
      z
        .object({
          search: z.string().optional(),
          role: z.enum(["user", "admin"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [isNull(users.deletedAt)];

      if (input?.search?.trim()) {
        const keyword = `%${input.search.trim()}%`;
        conditions.push(or(like(users.name, keyword), like(users.department, keyword))!);
      }

      if (input?.role) {
        conditions.push(eq(users.role, input.role));
      }

      if (conditions.length > 1) {
        return db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt));
      }

      return db.select().from(users).where(conditions[0]).orderBy(desc(users.createdAt));
    }),

  getById: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.id), isNull(users.deletedAt)))
        .limit(1);
      return result[0] ?? null;
    }),

  create: adminQuery
    .input(
      z.object({
        name: z.string().min(1),
        department: z.string().optional(),
        email: z.string().email().optional(),
        avatar: z.string().url().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const unionId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(users).values({
          unionId,
          name: input.name,
          department: input.department?.trim() || null,
          email: input.email,
          avatar:
            input.avatar ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`,
          role: input.role,
        }).$returningId();

        if (!inserted?.id) {
          throw new Error("User creation failed");
        }

        const newId = inserted.id;

        await createActivity(tx, {
          type: "user_created",
          description: `新增了员工「${input.name}」`,
          userId,
          req: ctx.req,
        });

        return newId;
      });

      return {
        id: result,
        ...input,
        unionId,
      };
    }),

  batchCreate: adminQuery
    .input(
      z.array(
        z.object({
          name: z.string().min(1),
          department: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["user", "admin"]).optional().default("user"),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

      const results = await db.transaction(async (tx) => {
        const inserted = [];
        for (const userData of input) {
          const unionId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          const [created] = await tx.insert(users).values({
            unionId,
            name: userData.name,
            department: userData.department?.trim() || null,
            email: userData.email,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.name)}`,
            role: userData.role ?? "user",
          }).$returningId();

          if (!created?.id) {
            throw new Error("Batch user creation failed");
          }

          inserted.push({
            id: created.id,
            ...userData,
            unionId,
          });
        }

        await createActivity(tx, {
          type: "user_imported",
          description: `批量导入了 ${inserted.length} 位员工`,
          userId,
          req: ctx.req,
        });

        return inserted;
      });

      return { count: results.length, users: results };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        department: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const { id, ...data } = input;

      await db.transaction(async (tx) => {
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.department !== undefined) updateData.department = data.department.trim() || null;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.role !== undefined) updateData.role = data.role;

        await tx.update(users).set(updateData).where(eq(users.id, id));

        const current = await tx
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);

        await createActivity(tx, {
          type: "user_updated",
          description: `更新了员工「${current[0]?.name ?? id}」`,
          userId,
          req: ctx.req,
        });
      });

      return { id, ...data };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ name: users.name })
          .from(users)
          .where(and(eq(users.id, input.id), isNull(users.deletedAt)))
          .limit(1);

        if (!existing[0]) {
          throw new Error("User not found");
        }

        await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, input.id));

        await createActivity(tx, {
          type: "user_deleted",
          description: `删除了员工「${existing[0]?.name ?? input.id}」`,
          userId,
          req: ctx.req,
        });
      });

      return { success: true };
    }),

  updateAvatar: adminQuery
    .input(z.object({ id: z.number(), avatar: z.string().url().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.transaction(async (tx) => {
        await tx.update(users).set({ avatar: input.avatar }).where(eq(users.id, input.id));

        const current = await tx.select({ name: users.name }).from(users).where(eq(users.id, input.id)).limit(1);

        await createActivity(tx, {
          type: "user_updated",
          description: `更新了员工「${current[0]?.name ?? input.id}」头像`,
          userId: ctx.user.id,
          req: ctx.req,
        });
      });

      return { id: input.id, avatar: input.avatar };
    }),

  generateAvatar: adminQuery
    .input(z.object({ prompt: z.string().min(1).max(500) }))
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
