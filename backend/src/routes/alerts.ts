import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { sessionStore } from "../services/sessionStore.js";

const paramsSchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v)),
});
const querySchema = z.object({ viewKey: z.string().optional() });

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/alerts/:userAddress", async (req, reply) => {
    const p = paramsSchema.safeParse(req.params);
    const q = querySchema.safeParse(req.query);
    if (!p.success || !q.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const user = getAddress(p.data.userAddress) as Address;
    if (q.data.viewKey) sessionStore.setViewKey(user, q.data.viewKey);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ user })}\n\n`);

    const unsubscribe = sessionStore.subscribe(user, (payload) => {
      reply.raw.write(`event: alert\ndata: ${JSON.stringify(payload)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`event: heartbeat\ndata: {}\n\n`);
    }, 25_000);
    heartbeat.unref?.();

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};
