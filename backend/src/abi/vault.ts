/**
 * ConfidentialLendingVault ABI (backend slice). Synced with the v2 contract —
 * includes LP shares + rate-engine reads so the relayer can compute
 * aggregates and feed a rate suggestion to the owner's UI.
 */
export const vaultAbi = [
  // -- reads --
  {
    type: "function",
    name: "getEncryptedCollateral",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getEncryptedDebt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getEncryptedLenderShares",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "borrowRateBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "supplyRateBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "utilizationBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
  {
    type: "event",
    name: "LiquiditySupplied",
    inputs: [{ name: "lender", type: "address", indexed: true }],
    anonymous: false,
  },
  {
    type: "event",
    name: "LiquidityWithdrawn",
    inputs: [{ name: "lender", type: "address", indexed: true }],
    anonymous: false,
  },
] as const;
