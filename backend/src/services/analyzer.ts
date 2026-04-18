import type { Address } from "viem";
import { readPositionSnapshot, decryptHandle } from "./onchain.js";
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

export async function analyzePosition(
  user: Address,
  viewKey: string | undefined,
  sdkUniqueId: string,
): Promise<Analysis> {
  const snap = await readPositionSnapshot(user);

  const context: PositionContext = {
    user,
    collateralAmount: null,
    debtAmount: null,
    ltvBps: null,
    zone: snap.zone,
    collateralPriceUsd: Number(snap.collateralPriceUsd8) / 1e8,
    debtPriceUsd: Number(snap.debtPriceUsd8) / 1e8,
    ltvMaxBps: LTV_MAX_BPS,
    liquidationThresholdBps: LIQUIDATION_THRESHOLD_BPS,
  };

  if (viewKey) {
    const [collat, debt, ltv] = await Promise.all([
      decryptHandle(snap.collateralHandle, viewKey),
      decryptHandle(snap.debtHandle, viewKey),
      decryptHandle(snap.ltvBpsHandle, viewKey),
    ]);
    context.collateralAmount = String(collat);
    context.debtAmount = String(debt);
    context.ltvBps = Number(ltv);
  }

  const prompt = buildAnalysisPrompt(context);
  const raw = await askChainGpt(prompt, sdkUniqueId);
  const { narrative, actions } = extractSuggestedActions(raw);

  return { narrative, actions, context };
}
