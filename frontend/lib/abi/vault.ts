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
  {
    type: "function",
    name: "collateralToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "debtToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  // -- writes --
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [
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
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
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
    ],
    outputs: [],
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

/**
 * Minimal ERC-7984 ABI slice — only what the frontend needs (setOperator so
 * the user can grant the vault permission to pull their confidential tokens,
 * plus isOperator and confidentialBalanceOf for UI sanity checks).
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
] as const;
