import { type Address, toHex } from "viem";

/**
 * Nox SDK adapter — placeholder.
 *
 * The real implementation will use `@iexec-nox/nox-handle-sdk` to:
 *   1. produce a signed `externalEuint256` handle for a plaintext amount
 *      (this involves the user's wallet signing an input-proof envelope)
 *   2. resolve a handle back to plaintext through the Nox Gateway (requires
 *      the holder to have an ACL grant on the handle)
 *
 * Until the SDK is installed, `encryptAmount` returns a deterministic-but-
 * unusable pair so the frontend compiles. Calls to the vault will revert
 * on-chain because `validateInputProof` will reject the bogus proof — this is
 * intentional; it keeps the UI buildable while making real transactions
 * impossible until the SDK is wired.
 */

export type EncryptedInput = {
  handle: `0x${string}`; // externalEuint256
  proof: `0x${string}`;  // bytes (input proof)
};

export async function encryptAmount(
  amount: bigint,
  _holder: Address,
): Promise<EncryptedInput> {
  // TODO(nox-sdk): replace with:
  //   const { handle, proof } = await noxHandle.input(amount, holder);
  return {
    handle: toHex(amount, { size: 32 }),
    proof: "0x",
  };
}

/**
 * Decrypt a handle via the Nox Gateway (Day 3 follow-up).
 * Until wired, returns 0n so the UI renders a placeholder balance.
 */
export async function decryptHandle(
  _handle: `0x${string}` | undefined,
): Promise<bigint> {
  // TODO(nox-sdk): replace with Gateway-mediated decrypt.
  return 0n;
}
