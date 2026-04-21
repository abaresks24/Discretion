/**
 * ConfidentialLendingVault ABI (backend slice). In sync with
 * contracts/src/ConfidentialLendingVault.sol.
 */
export const vaultAbi = [
  // -- reads --
  {
    type: "function",
    name: "getEncryptedCollateral",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getEncryptedDebt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  // -- events --
  {
    type: "event",
    name: "CollateralDeposited",
    inputs: [{ name: "user", type: "address", indexed: true }],
    anonymous: false,
  },
  {
    type: "event",
    name: "CollateralWithdrawn",
    inputs: [{ name: "user", type: "address", indexed: true }],
    anonymous: false,
  },
  {
    type: "event",
    name: "Borrowed",
    inputs: [{ name: "user", type: "address", indexed: true }],
    anonymous: false,
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [{ name: "user", type: "address", indexed: true }],
    anonymous: false,
  },
] as const;
