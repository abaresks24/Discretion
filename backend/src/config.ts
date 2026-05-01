import "dotenv/config";
import { z } from "zod";
import { type Address, getAddress } from "viem";

const addressSchema = z
  .string()
  .refine((v) => /^0x[a-fA-F0-9]{40}$/.test(v), "Invalid EVM address")
  .transform((v) => getAddress(v) as Address);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  ARBITRUM_SEPOLIA_RPC: z.string().url(),
  CHAIN_ID: z.coerce.number().int().default(421614),

  VAULT_ADDRESS: addressSchema,
  ORACLE_ADDRESS: addressSchema,
  COLLATERAL_ASSET: addressSchema,
  DEBT_ASSET: addressSchema,

  CHAINGPT_API_KEY: z.string().min(1),
  CHAINGPT_MODEL: z.string().default("general_assistant"),

  ALERT_MIN_INTERVAL_MS: z.coerce.number().int().nonnegative().default(15_000),

  // Mixer keeper — optional. If MIXER_OPERATOR_PRIVATE_KEY + WRAP_QUEUE_ADDRESS
  // are present, the relayer polls pendingIds() and submits processBatch() as
  // the on-chain operator.
  WRAP_QUEUE_ADDRESS: addressSchema.optional(),
  WRAP_QUEUE_WETH_ADDRESS: addressSchema.optional(),
  WRAP_QUEUE_USDC_ADDRESS: addressSchema.optional(),
  UNWRAP_QUEUE_ADDRESS: addressSchema.optional(),
  MIXER_OPERATOR_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid private key")
    .optional(),
  MIXER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  MIXER_MIN_BATCH: z.coerce.number().int().positive().default(1),
  MIXER_BATCH_LIMIT: z.coerce.number().int().positive().max(100).default(20),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
