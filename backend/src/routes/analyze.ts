import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { analyzePosition } from "../services/analyzer.js";

const bigintString = z
  .string()
  .regex(/^\d+$/, "must be a non-negative integer")
  .transform((s) => BigInt(s));

const bodySchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v), "invalid address"),
  // Pre-decrypted amounts the frontend obtained via the Nox Gateway. Optional —
  // without them ChainGPT gets only prices + the fact that a position exists.
  collateralRaw: bigintString.optional(),
  debtRaw: bigintString.optional(),
});

export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/analyze", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = getAddress(parsed.data.userAddress) as Address;
    try {
      const analysis = await analyzePosition(
        user,
        {
          collateralRaw: parsed.data.collateralRaw,
          debtRaw: parsed.data.debtRaw,
        },
        `analyze-${user}-${Date.now()}`,
      );
      return { ok: true, ...analysis };
    } catch (err) {
      app.log.error({ err, user }, "analyze failed");
      return reply.code(502).send({ error: "analyzer_unavailable" });
    }
  });
};
