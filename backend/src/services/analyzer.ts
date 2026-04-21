import type { Address } from "viem";
import { readPositionSnapshot, computeZone } from "./onchain.js";
import {
  askChainGpt,
  buildAnalysisPrompt,
  extractSuggestedActions,
  type PositionContext,
  type SuggestedAction,
} from "./chaingpt.js";

const LTV_MAX_BPS = 7500;
const LIQUIDATION_THRESHOLD_BPS = 8500;

export type Analysis = {
  narrative: string;
  actions: SuggestedAction[];
  context: PositionContext;
};

/**
 * Pre-decrypted amounts the frontend passes after reading its view through the
 * Nox gateway. All values in the underlying token's native units (6 decimals
 * for cRLC and cUSDC).
 */
export type DecryptedInputs = {
  collateralRaw?: bigint;
  debtRaw?: bigint;
};

export async function analyzePosition(
  user: Address,
  decrypted: DecryptedInputs,
  sdkUniqueId: string,
): Promise<Analysis> {
  const snap = await readPositionSnapshot(user);

  const context: PositionContext = {
    user,
    collateralAmount: null,
    debtAmount: null,
    ltvBps: null,
    zone: 0,
    collateralPriceUsd: Number(snap.collateralPriceUsd8) / 1e8,
    debtPriceUsd: Number(snap.debtPriceUsd8) / 1e8,
    ltvMaxBps: LTV_MAX_BPS,
    liquidationThresholdBps: LIQUIDATION_THRESHOLD_BPS,
  };

  if (decrypted.collateralRaw !== undefined && decrypted.debtRaw !== undefined) {
    const { zone, ltvBps } = computeZone(
      decrypted.collateralRaw,
      decrypted.debtRaw,
      snap.collateralPriceUsd8,
      snap.debtPriceUsd8,
    );
    context.collateralAmount = String(decrypted.collateralRaw);
    context.debtAmount = String(decrypted.debtRaw);
    context.ltvBps = ltvBps;
    context.zone = zone;
  }

  const prompt = buildAnalysisPrompt(context);
  const raw = await askChainGpt(prompt, sdkUniqueId);
  const { narrative, actions } = extractSuggestedActions(raw);

  return { narrative, actions, context };
}
