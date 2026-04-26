import { eq } from "drizzle-orm";
import { systemSettings } from "@db/schema";
import { env } from "./env";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-store";
import { getDb } from "../queries/connection";

const KIMI_API_KEY_SETTING = "kimi_api_key";

async function getSettingRow(key: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return rows[0] ?? null;
}

export async function getStoredKimiApiKey() {
  const row = await getSettingRow(KIMI_API_KEY_SETTING);
  if (!row?.value) return "";
  return row.isEncrypted ? decryptSecret(row.value) : row.value;
}

async function getStoredKimiApiKeyState() {
  const row = await getSettingRow(KIMI_API_KEY_SETTING);
  if (!row?.value) {
    return { state: "missing" as const, value: "" };
  }

  try {
    return {
      state: "ok" as const,
      value: row.isEncrypted ? decryptSecret(row.value) : row.value,
    };
  } catch {
    return {
      state: "unreadable" as const,
      value: "",
    };
  }
}

export async function getKimiApiKey() {
  const stored = await getStoredKimiApiKey();
  if (stored.trim()) {
    return stored.trim();
  }

  return env.kimiApiKey.trim();
}

export async function getKimiApiKeySummary() {
  const stored = await getStoredKimiApiKeyState();
  if (stored.state === "ok" && stored.value.trim()) {
    return {
      configured: true,
      source: "database" as const,
      maskedValue: maskSecret(stored.value),
      unreadable: false,
    };
  }

  if (stored.state === "unreadable") {
    return {
      configured: true,
      source: "database_unreadable" as const,
      maskedValue: "",
      unreadable: true,
    };
  }

  if (env.kimiApiKey.trim()) {
    return {
      configured: true,
      source: "env" as const,
      maskedValue: maskSecret(env.kimiApiKey),
      unreadable: false,
    };
  }

  return {
    configured: false,
    source: "none" as const,
    maskedValue: "",
    unreadable: false,
  };
}

export async function saveKimiApiKey(apiKey: string, updatedBy?: number | null) {
  const db = getDb();
  const encryptedValue = encryptSecret(apiKey.trim());

  await db
    .insert(systemSettings)
    .values({
      key: KIMI_API_KEY_SETTING,
      value: encryptedValue,
      isEncrypted: true,
      updatedBy: updatedBy ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        value: encryptedValue,
        isEncrypted: true,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function clearKimiApiKey() {
  const db = getDb();
  await db.delete(systemSettings).where(eq(systemSettings.key, KIMI_API_KEY_SETTING));
}
