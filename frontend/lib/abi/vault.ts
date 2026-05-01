/**
 * ConfidentialLendingVault ABI (frontend slice).
 *
 * In sync with contracts/src/ConfidentialLendingVault.sol. Encrypted arg types
 * (`euint256`, `externalEuint256`) compile down to `bytes32` in the ABI;
 * callers must pre-encrypt amounts via the Nox JS SDK and pass the resulting
 * handle + input proof.
 */
export const vaultAbi = [
  // -- reads (handles — decrypt via Nox gateway) --
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
    name: "collateral",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "cToken", type: "address" },
      { name: "ltvBps", type: "uint16" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "collateralAssets",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "collateralAssetsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "listCollateralAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "assets", type: "address[]" },
      { name: "cTokens", type: "address[]" },
      { name: "ltvs", type: "uint16[]" },
      { name: "actives", type: "bool[]" },
    ],
  },
  {
    type: "function",
    name: "debtToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "debtAsset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
  {
    type: "function",
    name: "totalDebt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupplied",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "rateUpdatedAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint40" }],
  },
  // -- writes --
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addCollateralAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "cToken", type: "address" },
      { name: "ltvBps", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setCollateralAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "ltvBps", type: "uint16" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "plainAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "plainAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "supplyLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "plainAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "plainAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setRates",
    stateMutability: "nonpayable",
    inputs: [
      { name: "borrowBps", type: "uint256" },
      { name: "supplyBps", type: "uint256" },
      { name: "utilBps", type: "uint256" },
    ],
    outputs: [],
  },
  // -- liquidation --
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revealLiquidatable",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "ltvBps", type: "uint256" },
      { name: "debtAmount", type: "uint256" },
      { name: "assets", type: "address[]" },
      { name: "collateralAmounts", type: "uint256[]" },
      { name: "deadline", type: "uint40" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "clearLiquidatable",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setLiquidationOperator",
    stateMutability: "nonpayable",
    inputs: [{ name: "op", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidationOperator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "liquidatables",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "revealedAt", type: "uint40" },
      { name: "deadline", type: "uint40" },
      { name: "ltvBps", type: "uint96" },
      { name: "debtAmount", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "liquidatableCollat",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
  // -- events --
  {
    type: "event",
    name: "CollateralDeposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CollateralWithdrawn",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CollateralAssetAdded",
    inputs: [
      { name: "asset", type: "address", indexed: true },
      { name: "cToken", type: "address", indexed: true },
      { name: "ltvBps", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CollateralAssetUpdated",
    inputs: [
      { name: "asset", type: "address", indexed: true },
      { name: "ltvBps", type: "uint16", indexed: false },
      { name: "active", type: "bool", indexed: false },
    ],
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
  {
    type: "event",
    name: "RatesUpdated",
    inputs: [
      { name: "borrowBps", type: "uint256", indexed: false },
      { name: "supplyBps", type: "uint256", indexed: false },
      { name: "utilizationBps", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PositionLiquidatable",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "ltvBps", type: "uint256", indexed: false },
      { name: "debtAmount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint40", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PositionLiquidatableCollat",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Liquidated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "debtRepaid", type: "uint256", indexed: false },
      { name: "bonusBps", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * UnwrapQueue ABI — symmetric exit mixer for cUSDC.
 */
export const unwrapQueueAbi = [
  {
    type: "function",
    name: "queueUnwrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destination", type: "address" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "queueLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingIds",
    stateMutability: "view",
    inputs: [
      { name: "cursor", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "event",
    name: "Queued",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BatchSubmitted",
    inputs: [
      { name: "reqHandle", type: "bytes32", indexed: true },
      { name: "count", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BatchProcessed",
    inputs: [
      { name: "reqHandle", type: "bytes32", indexed: true },
      { name: "count", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * WrapQueue ABI — batched wrapping / soft mixer for plaintext → confidential
 * token conversions.
 */
export const wrapQueueAbi = [
  {
    type: "function",
    name: "queueWrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destination", type: "address" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "processBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "ids", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pendingIds",
    stateMutability: "view",
    inputs: [
      { name: "cursor", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "queueLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Queued",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "BatchProcessed",
    inputs: [{ name: "count", type: "uint256", indexed: false }],
    anonymous: false,
  },
] as const;

/**
 * Minimal ERC-7984 ABI slice — setOperator / isOperator / confidentialBalanceOf
 * plus the wrapper's `wrap(to, amount)` (all Nox cTokens we use are
 * `ERC20ToERC7984Wrapper` instances so the wrap entry-point is always there).
 */
export const erc7984Abi = [
  {
    type: "function",
    name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  // wrap(to, amount) — inherited from ERC20ToERC7984Wrapper. Takes a plaintext
  // amount (privacy is broken at the wrap boundary; see README for rationale).
  {
    type: "function",
    name: "wrap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "underlying",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

/**
 * Minimal ERC-20 ABI slice for approving the cToken wrapper to spend a user's
 * plaintext RLC / USDC balance before `wrap(...)`.
 */
export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
