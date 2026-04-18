# Contracts — Foundry project

Solidity `^0.8.24`. Foundry-based. Targets Arbitrum Sepolia (`chainId 421614`).

## Contracts

- **`HybridPriceOracle.sol`** — Chainlink feed + owner-only manual override (testnet demo). 8-decimal outputs. Staleness checks.
- **`ConfidentialLendingVault.sol`** — single-collateral / single-debt lending with confidential balances. FHE operations go through `libraries/FHE.sol`.
- **`libraries/FHE.sol`** — **placeholder** encrypted-math library. Every operation is marked `// FIXME(nox): ...` and will be replaced with the real Nox TFHE primitives on Day 2, after the workshop confirms the iExec Nox import paths. See [`CLAUDE.md` §5.2 and §15](../CLAUDE.md#15-open-questions--unknowns).

## Install

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install smartcontractkit/chainlink-brownie-contracts
```

(The `remappings.txt` expects these three libs under `lib/`.)

## Test

```bash
forge test -vv
```

Covers: oracle happy path / staleness / decimals, vault deposit / borrow / repay / withdraw / liquidate, zone crossings, fuzz on LTV boundary.

## Deploy (Arbitrum Sepolia)

```bash
cp .env.example .env          # fill in every key
source .env
forge script script/Deploy.s.sol \
  --rpc-url $ARBITRUM_SEPOLIA_RPC \
  --broadcast \
  --verify \
  -vvvv
```

## Demo: push a price

```bash
ORACLE_ADDRESS=0x... PRICE_ASSET=0x... PRICE_USD_8DEC=250000000000 \
  forge script script/PushPrice.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```

## Post-workshop checklist (Day 2)

- [ ] Replace `libraries/FHE.sol` internals with real Nox/TFHE calls.
- [ ] Replace `IConfidentialToken.sol` with the actual Nox ERC-7984 interface (signatures likely include `externalEuint64` + proof bytes).
- [ ] Refactor `_ltvBps` to avoid any division that reveals collateral — cross-multiply against threshold (see FIXME in the function).
- [ ] Delete mock tokens from `test/mocks/` (or gate them behind a test-only profile) once real Nox test utilities are available.
- [ ] Confirm whether zone reveal needs a Gateway round-trip and adjust `_computeZone` accordingly.
