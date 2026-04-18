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
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
