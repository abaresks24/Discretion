import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAddress, type Address } from "viem";
import { sessionStore } from "../services/sessionStore.js";
import { config } from "../config.js";

const paramsSchema = z.object({
  userAddress: z.string().refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v)),
});

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/alerts/:userAddress", async (req, reply) => {
    const p = paramsSchema.safeParse(req.params);
    if (!p.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const user = getAddress(p.data.userAddress) as Address;

    // Mirror the CORS plugin's headers manually — reply.raw.writeHead bypasses
    // Fastify's response-modification hooks, so we set them explicitly here.
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
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ user })}\n\n`);

    const unsubscribe = sessionStore.subscribe(user, (payload) => {
      reply.raw.write(`event: refresh\ndata: ${JSON.stringify(payload)}\n\n`);
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
