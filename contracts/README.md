# Contracts — Foundry project

Solidity `^0.8.28`. Foundry-based. Targets Arbitrum Sepolia (`chainId 421614`).

## Contracts

- **`HybridPriceOracle.sol`** — Chainlink feed + owner-only manual override (testnet demo). 8-decimal outputs. Staleness checks.
- **`ConfidentialLendingVault.sol` (v3.4)** — multi-collateral lending with confidential per-user balances + plaintext aggregate counters.
  - Supported collateral: RLC, WETH, USDC.
  - Single debt asset: USDC.
  - Per-user `_collateralOf[asset][user]`, `_debt[user]`, `_lenderShares[user]` — all `euint256`.
  - Plaintext aggregates: `totalDebt`, `totalSupplied` — used to derive live `utilizationBps()`.
  - Borrow APR == supply APR (no protocol margin), set by a piecewise-linear approximation of a concave log curve. See top-level `README.md` for the curve shape and anchor points.
- **`WrapQueue.sol`** — soft mixer for plaintext → ERC-7984 conversions. One queue per (underlying, wrapper) pair. Operator role calls `processBatch(ids)` to wrap aggregate then redistribute.
- **`UnwrapQueue.sol`** — symmetric exit mixer for ERC-7984 → plaintext. Same operator pattern.
- **`DiscretionTokenWrapper.sol`** — `cWETH`. ERC-20 → ERC-7984 wrapper since iExec Nox doesn't pre-deploy a WETH cToken on Arbitrum Sepolia.

## Install

```bash
npm install                  # @iexec-nox/* + @openzeppelin libs (Solidity sources via npm)
forge install                # forge-std + chainlink-brownie-contracts
```

## Build

```bash
forge build
```

## Deploy

### Initial deployment (oracle + vault + queues + cWETH)
```bash
cp .env.example .env
source .env
forge script script/Deploy.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC \
  --broadcast \
  --verify \
  -vvvv
```

### Add WrapQueues for assets that didn't get one in the initial deploy
```bash
forge script script/DeployExtraQueues.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```
Used to ship WETH + USDC entry mixers mid-hackathon.

### Redeploy the vault only (keeping oracle, queues, cTokens)
```bash
forge script script/RedeployVault.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```
Used during the hackathon for the ACL fix and the plaintext-aggregates upgrade.

### Demo: push a price
```bash
ORACLE_ADDRESS=0x... PRICE_ASSET=0x... PRICE_USD_8DEC=250000000000 \
  forge script script/PushPrice.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```

## Two important on-chain quirks

### Persistent ACL on stored handles
`Nox.add` / `Nox.mul` / etc. grant *transient* ACL (current tx only) to the calling contract on the result handle. If your contract stores that handle and reads it in a later tx, you MUST grant *persistent* ACL to `address(this)`.

In Discretion this happens inside `_grantAudit`:

```solidity
function _grantAudit(euint256 handle, address user) internal {
    INoxCompute c = INoxCompute(Nox.noxComputeContract());
    bytes32 raw = euint256.unwrap(handle);
    if (raw != bytes32(0)) {
        c.allow(raw, address(this));   // ← critical — without this, _checkBorrowLtv reverts NotAllowed
        c.allow(raw, user);
        c.allow(raw, owner);
        ...
    }
}
```

Forgetting this line costs about 4 hours of debugging and a custom-error reverse-engineering session — see `feedback.md`.

### Plaintext aggregates + `plainAmount` parameter
`borrow / repay / supplyLiquidity / withdrawLiquidity` take a third `uint256 plainAmount` argument alongside the encrypted `(handle, proof)`. The vault uses the encrypted amount for FHE math (per-user privacy) and the plain amount for the public `totalDebt` / `totalSupplied` counters that drive the rate curve.

Trust model for the hackathon: the frontend is honest — caller's plain amount equals the value they encrypted. Production would `Nox.eq(amount, plainAmount)` and abort on mismatch.

## Test

```bash
forge test -vv
```
(Tests are scoped to oracle and pre-FHE math; FHE-flow E2E tests run against the live testnet via the frontend / backend.)
