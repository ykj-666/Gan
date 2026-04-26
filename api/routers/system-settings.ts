import { z } from "zod";
import { createRouter, adminQuery } from "../middleware";
import {
  clearKimiApiKey,
  getKimiApiKeySummary,
  saveKimiApiKey,
} from "../lib/system-settings";

export const systemSettingsRouter = createRouter({
  getAiSecurityConfig: adminQuery.query(async () => {
    const kimi = await getKimiApiKeySummary();
    return {
      kimiApiKeyConfigured: kimi.configured,
      kimiApiKeyMaskedValue: kimi.maskedValue,
      kimiApiKeySource: kimi.source,
      kimiApiKeyUnreadable: kimi.unreadable,
    };
  }),

  setKimiApiKey: adminQuery
    .input(
      z.object({
        apiKey: z.string().trim().min(10).max(500),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await saveKimiApiKey(input.apiKey, ctx.user.id);
      const kimi = await getKimiApiKeySummary();
      return {
        success: true,
        kimiApiKeyConfigured: kimi.configured,
        kimiApiKeyMaskedValue: kimi.maskedValue,
        kimiApiKeySource: kimi.source,
        kimiApiKeyUnreadable: kimi.unreadable,
      };
    }),

  clearKimiApiKey: adminQuery.mutation(async () => {
    await clearKimiApiKey();
    const kimi = await getKimiApiKeySummary();
    return {
      success: true,
      kimiApiKeyConfigured: kimi.configured,
      kimiApiKeyMaskedValue: kimi.maskedValue,
      kimiApiKeySource: kimi.source,
      kimiApiKeyUnreadable: kimi.unreadable,
    };
  }),
});
