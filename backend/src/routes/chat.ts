import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { readPositionSnapshot, decryptHandle } from "../services/onchain.js";
import {
  buildChatPrompt,
  extractSuggestedActions,
  streamChainGpt,
  type PositionContext,
} from "../services/chaingpt.js";
import { sessionStore } from "../services/sessionStore.js";

const LTV_MAX_BPS = 7500;
const LIQUIDATION_THRESHOLD_BPS = 8500;

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  }),
).max(20);

const bodySchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v)),
  viewKey: z.string().optional(),
  message: z.string().min(1).max(2000),
  history: historySchema.default([]),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/chat", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = getAddress(parsed.data.userAddress) as Address;
    const viewKey = parsed.data.viewKey ?? sessionStore.getViewKey(user);
    if (parsed.data.viewKey) sessionStore.setViewKey(user, parsed.data.viewKey);

    const snap = await readPositionSnapshot(user);
    const ctx: PositionContext = {
      user,
      collateralAmount: null,
      debtAmount: null,
      ltvBps: null,
      zone: snap.zone,
      collateralPriceUsd: Number(snap.collateralPriceUsd8) / 1e8,
      debtPriceUsd: Number(snap.debtPriceUsd8) / 1e8,
      ltvMaxBps: LTV_MAX_BPS,
      liquidationThresholdBps: LIQUIDATION_THRESHOLD_BPS,
    };

    if (viewKey) {
      const [collat, debt, ltv] = await Promise.all([
        decryptHandle(snap.collateralHandle, viewKey),
        decryptHandle(snap.debtHandle, viewKey),
        decryptHandle(snap.ltvBpsHandle, viewKey),
      ]);
      ctx.collateralAmount = String(collat);
      ctx.debtAmount = String(debt);
      ctx.ltvBps = Number(ltv);
    }

    const prompt = buildChatPrompt(ctx, parsed.data.history, parsed.data.message);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let accumulated = "";
    try {
      for await (const chunk of streamChainGpt(prompt, `chat-${user}-${Date.now()}`)) {
        accumulated += chunk;
        reply.raw.write(`event: token\ndata: ${JSON.stringify({ chunk })}\n\n`);
      }
      const { actions } = extractSuggestedActions(accumulated);
      reply.raw.write(`event: done\ndata: ${JSON.stringify({ actions })}\n\n`);
    } catch (err) {
      app.log.error({ err, user }, "chat stream failed");
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ error: "chaingpt_error" })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  });
};
