import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config.js";
import { publicClient } from "../services/onchain.js";

/// Frontend self-reports a liquidatable position. We trust the caller
/// because this is called from a user's own `/borrow` page once the
/// frontend has decrypted their state and seen LTV >= 85%. The contract
/// itself enforces `ltvBps >= LIQUIDATION_THRESHOLD_BPS` so there's also
/// an on-chain floor.

const vaultAbiFragment = parseAbi([
  "function revealLiquidatable(address user, uint256 ltvBps, uint256 debtAmount, address[] assets, uint256[] collateralAmounts, uint40 deadline) external",
  "function clearLiquidatable(address user) external",
  "function liquidationOperator() view returns (address)",
]);

const bodySchema = z.object({
  user: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
    .transform((v) => v as Address),
  ltvBps: z.coerce.number().int().min(8500).max(100_000),
  debtAmount: z.coerce.bigint(),
  assets: z
    .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"))
    .min(1)
    .max(10),
  collateralAmounts: z.array(z.coerce.bigint()).min(1).max(10),
  deadlineSec: z.coerce.number().int().positive().max(86_400).default(3600),
});

export const liquidateRoutes: FastifyPluginAsync = async (app) => {
  if (!config.MIXER_OPERATOR_PRIVATE_KEY) {
    app.log.warn("liquidate routes disabled: no operator key in env");
    return;
  }
  const account = privateKeyToAccount(config.MIXER_OPERATOR_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(config.ARBITRUM_SEPOLIA_RPC),
  });

  app.post("/liquidatable", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid body",
        issues: parsed.error.issues,
      });
    }
    const {
      user,
      ltvBps,
      debtAmount,
      assets,
      collateralAmounts,
      deadlineSec,
    } = parsed.data;
    if (assets.length !== collateralAmounts.length) {
      return reply.status(400).send({ error: "assets/amounts length mismatch" });
    }

    const operator = (await publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbiFragment,
      functionName: "liquidationOperator",
    })) as Address;
    if (operator.toLowerCase() !== account.address.toLowerCase()) {
      return reply.status(503).send({
        error: "vault operator mismatch — backend cannot reveal",
        expected: account.address,
        onChain: operator,
      });
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSec);

    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: config.VAULT_ADDRESS,
        abi: vaultAbiFragment,
        functionName: "revealLiquidatable",
        args: [
          user,
          BigInt(ltvBps),
          debtAmount,
          assets as readonly Address[],
          collateralAmounts as readonly bigint[],
          deadline,
        ],
      });
      const hash = await wallet.writeContract(request);
      app.log.info({ user, ltvBps, hash }, "Liquidation revealed");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { ok: true, hash, status: receipt.status };
    } catch (err: any) {
      app.log.error({ err: err?.shortMessage ?? String(err) }, "reveal failed");
      return reply.status(500).send({
        error: err?.shortMessage ?? err?.message ?? "reveal failed",
      });
    }
  });

  app.post("/liquidatable/clear/:user", async (req, reply) => {
    const userParam = (req.params as { user: string }).user;
    if (!/^0x[a-fA-F0-9]{40}$/.test(userParam)) {
      return reply.status(400).send({ error: "invalid user address" });
    }
    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: config.VAULT_ADDRESS,
        abi: vaultAbiFragment,
        functionName: "clearLiquidatable",
        args: [userParam as Address],
      });
      const hash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return { ok: true, hash, status: receipt.status };
    } catch (err: any) {
      return reply
        .status(500)
        .send({ error: err?.shortMessage ?? err?.message ?? "clear failed" });
    }
  });
};
