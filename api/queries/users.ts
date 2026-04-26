import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateSet.name = data.name;
  if (data.department !== undefined) updateSet.department = data.department;
  if (data.email !== undefined) updateSet.email = data.email;
  if (data.avatar !== undefined) updateSet.avatar = data.avatar;
  if (data.passwordHash !== undefined) updateSet.passwordHash = data.passwordHash;
  if (data.role !== undefined) updateSet.role = data.role;

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({
      set: updateSet,
    });
}
