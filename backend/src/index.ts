import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import { loggerConfig } from "./logger.js";
import { healthRoutes } from "./routes/health.js";
import { analyzeRoutes } from "./routes/analyze.js";
import { chatRoutes } from "./routes/chat.js";
import { alertsRoutes } from "./routes/alerts.js";
import { startEventWatcher } from "./services/eventWatcher.js";

async function bootstrap() {
  const app = Fastify({ logger: loggerConfig });

  await app.register(sensible);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });

  await app.register(healthRoutes);
  await app.register(analyzeRoutes);
  await app.register(chatRoutes);
  await app.register(alertsRoutes);

  const stopWatcher = startEventWatcher(app.log);

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    stopWatcher();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(
    { vault: config.VAULT_ADDRESS, oracle: config.ORACLE_ADDRESS },
    "relayer ready",
  );
}

bootstrap().catch((err) => {
  console.error("fatal boot error", err);
  process.exit(1);
});
