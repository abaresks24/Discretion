import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { analyzePosition } from "../services/analyzer.js";
import { sessionStore } from "../services/sessionStore.js";

const bodySchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v), "invalid address"),
  viewKey: z.string().optional(),
});

export const analyzeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/analyze", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const user = getAddress(parsed.data.userAddress) as Address;
    if (parsed.data.viewKey) sessionStore.setViewKey(user, parsed.data.viewKey);

    try {
      const analysis = await analyzePosition(
        user,
        parsed.data.viewKey ?? sessionStore.getViewKey(user),
        `analyze-${user}-${Date.now()}`,
      );
      return { ok: true, ...analysis };
    } catch (err) {
      app.log.error({ err, user }, "analyze failed");
      return reply.code(502).send({ error: "analyzer_unavailable" });
    }
  });
};
