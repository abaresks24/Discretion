/**
 * Thin adapters kept for call-sites that don't live inside a React tree.
 * The real encrypt/decrypt flow now goes through `hooks/useNoxHandle.ts`,
 * which wires `@iexec-nox/handle` to the current wagmi wallet client.
 *
 * These no-op stubs return values that will cause on-chain calls to fail
 * gracefully (bogus proof) if ever reached — forcing callers to migrate
 * to the hook.
 */

import { toHex } from "viem";

export type EncryptedInput = {
  handle: `0x${string}`;
  proof: `0x${string}`;
};

export async function encryptAmount(amount: bigint): Promise<EncryptedInput> {
  console.warn("[noxSdk] encryptAmount fallback — use useNoxHandle() instead.");
  return {
    handle: toHex(amount, { size: 32 }),
    proof: "0x",
  };
}

export async function decryptHandle(): Promise<bigint> {
  console.warn("[noxSdk] decryptHandle fallback — use useNoxHandle() instead.");
  return 0n;
}
