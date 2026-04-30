/**
 * HybridPriceOracle — minimal ABI slice for the frontend. Prices are 8-dec
 * Chainlink-style scalars; convert to USD float by dividing by 1e8.
 */
export const oracleAbi = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "isOverridden",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "feedOf",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  // -- writes (owner-only) --
  {
    type: "function",
    name: "setManualOverride",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "clearManualOverride",
    stateMutability: "nonpayable",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [],
  },
] as const;
