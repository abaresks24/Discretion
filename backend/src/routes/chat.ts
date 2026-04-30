import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { readPositionSnapshot, computeZone } from "../services/onchain.js";
import {
  buildChatPrompt,
  extractSuggestedActions,
  streamChainGpt,
  type PositionContext,
} from "../services/chaingpt.js";
import { config } from "../config.js";

const LTV_MAX_BPS = 7500;
const LIQUIDATION_THRESHOLD_BPS = 8500;

const bigintString = z
  .string()
  .regex(/^\d+$/, "must be a non-negative integer")
  .transform((s) => BigInt(s));

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  }),
).max(20);

const bodySchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v)),
  message: z.string().min(1).max(2000),
  history: historySchema.default([]),
  collateralRaw: bigintString.optional(),
  debtRaw: bigintString.optional(),
  // Optional pre-computed aggregate the frontend can send when it has
  // already decrypted the multi-collat position. Bypasses on-chain reads.
  snapshot: z
    .object({
      totalCollatUsd: z.number().nonnegative(),
      weightedCollatUsd: z.number().nonnegative(),
      debtUsd: z.number().nonnegative(),
      ltvBps: z.number().int().nonnegative(),
      zone: z.number().int().min(0).max(3),
      perAsset: z
        .array(
          z.object({
            symbol: z.string(),
            amount: z.number().nonnegative(),
            valueUsd: z.number().nonnegative(),
            ltvBps: z.number().int().nonnegative(),
          }),
        )
        .max(8)
        .default([]),
    })
    .optional(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/chat", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = getAddress(parsed.data.userAddress) as Address;

    const ctx: PositionContext = {
      user,
      collateralAmount: null,
      debtAmount: null,
      ltvBps: null,
      zone: 0,
      collateralPriceUsd: 0,
      debtPriceUsd: 1, // USDC peg — snapshot.debtUsd is already USD
      ltvMaxBps: LTV_MAX_BPS,
      liquidationThresholdBps: LIQUIDATION_THRESHOLD_BPS,
    };

    // Fast path: when the frontend supplies a decrypted snapshot we skip all
    // on-chain reads. This avoids hammering the public RPC (which rate-limits
    // aggressively) and means the prompt is built from already-decrypted data.
    if (parsed.data.snapshot) {
      const s = parsed.data.snapshot;
      const breakdown = s.perAsset.length
        ? s.perAsset.map((a) => `${a.amount.toFixed(4)} ${a.symbol}`).join(" + ")
        : "no collateral";
      ctx.collateralAmount = `${s.totalCollatUsd.toFixed(2)} USD (${breakdown})`;
      ctx.debtAmount = `${s.debtUsd.toFixed(2)} USD`;
      ctx.ltvBps = s.ltvBps;
      ctx.zone = s.zone;
    } else {
      // Slow path — only used when frontend hasn't decrypted yet. Read the
      // snapshot from chain. Tolerant to RPC failures; on error we proceed
      // with empty context so ChainGPT can still answer general questions.
      try {
        const snap = await readPositionSnapshot(user);
        ctx.collateralPriceUsd = Number(snap.collateralPriceUsd8) / 1e8;
        ctx.debtPriceUsd = Number(snap.debtPriceUsd8) / 1e8;
        if (
          parsed.data.collateralRaw !== undefined &&
          parsed.data.debtRaw !== undefined
        ) {
          const { zone, ltvBps } = computeZone(
            parsed.data.collateralRaw,
            parsed.data.debtRaw,
            snap.collateralPriceUsd8,
            snap.debtPriceUsd8,
          );
          ctx.collateralAmount = String(parsed.data.collateralRaw);
          ctx.debtAmount = String(parsed.data.debtRaw);
          ctx.ltvBps = ltvBps;
          ctx.zone = zone;
        }
      } catch (rpcErr) {
        app.log.warn({ rpcErr, user }, "snapshot RPC failed, continuing without it");
      }
    }

    const prompt = buildChatPrompt(ctx, parsed.data.history, parsed.data.message);

    // Same CORS story as /alerts — we bypass Fastify's hooks with reply.raw,
    // so the relevant headers must be echoed by hand.
    const origin = req.headers.origin ?? "";
    const allowed = config.CORS_ORIGIN.split(",").map((s) => s.trim());
    const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
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
      const detail =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      app.log.error({ err, detail, user }, "chat stream failed");
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ error: "chaingpt_error", detail })}\n\n`,
      );
    } finally {
      reply.raw.end();
    }
  });
};
