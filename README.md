# Confidential Lending Vault + AI Copilot

> Submission to the iExec Vibe Coding Challenge (April 2026).
> Built on **iExec Nox (ERC-7984)** for confidential balances and **ChainGPT** for the AI risk copilot. Deployed on **Arbitrum Sepolia**.

---

## Problem

In open DeFi, every lending position is public: anyone can see collateral, debt, and LTV on-chain. Whales get front-run, strategies are copied, and positions become targets for coordinated liquidation attacks. Privacy is the missing primitive.

## Solution

A lending vault where **collateral and debt balances are confidential** (ERC-7984 via iExec Nox), paired with an **AI copilot** (ChainGPT) that:

- monitors position health in real time;
- alerts the user when LTV drifts into a danger zone;
- suggests **concrete, numerically precise** remediation actions (partial repay, add collateral, withdraw collateral) that the user can apply in one click.

## Architecture

See [`CLAUDE.md` §3](./CLAUDE.md#3-architecture-overview) for the full diagram. Three layers:

1. **On-chain (Arbitrum Sepolia):** `ConfidentialLendingVault` + `HybridPriceOracle`, Solidity `^0.8.24`, deployed via Foundry. Source of truth for all positions.
2. **Backend relayer (Node.js + Fastify):** stateless orchestrator. Watches on-chain events, calls ChainGPT, exposes endpoints to the frontend. **Never holds user funds. Never signs user transactions.**
3. **Frontend (Next.js + wagmi):** connects the user's wallet, reads encrypted balances, signs transactions directly.

## Live demo (fill in on Day 6)

- **Frontend:** `<vercel-url>`
- **Backend relayer:** `<railway-url>`
- **Contracts (Arbitrum Sepolia):**
  - `ConfidentialLendingVault`: `0x...`
  - `HybridPriceOracle`: `0x...`
- **Demo video (≤ 4 min):** `<youtube-or-loom-url>`

## How it works

1. User connects wallet on Arbitrum Sepolia.
2. Wraps WETH / USDC into their confidential (ERC-7984) variants once.
3. Deposits confidential WETH into the vault as collateral → balances encrypted on-chain.
4. Borrows confidential USDC against it → LTV is computed client-side from an encrypted health factor the user decrypts with their view key.
5. The backend's event watcher listens for `HealthFactorThresholdCrossed`. On a crossing it pings ChainGPT with the current position context and streams an alert back over SSE.
6. ChainGPT returns a natural-language alert plus a structured JSON block of `suggested_actions`. Each action renders in the UI as a one-click button that packages the correct `repay`/`withdraw`/`depositCollateral` call for the wallet to sign.

## Tech stack

| Layer | Stack |
|---|---|
| Contracts | Solidity `^0.8.24`, Foundry, iExec Nox (ERC-7984), Chainlink price feeds |
| Backend | Node.js 20, Fastify, viem, `@chaingpt/generalchat`, SSE |
| Frontend | Next.js 14 (App Router), TypeScript, wagmi v2, viem v2, Tailwind, shadcn/ui |
| Infra | Arbitrum Sepolia (`chainId 421614`), Vercel (frontend), Railway (backend) |

## Local setup

### Prerequisites
- Node.js 20+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- An EVM wallet funded on Arbitrum Sepolia (faucet: https://faucet.quicknode.com/arbitrum/sepolia)
- A ChainGPT API key (contact `@vladnazarxyz` on Telegram for hackathon credits)

### Clone
```bash
git clone <repo-url>
cd HackIexec
```

### Contracts
```bash
cd contracts
cp .env.example .env     # fill in ARBITRUM_SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY
forge install
forge build
forge test
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
```

### Backend
```bash
cd backend
cp .env.example .env     # fill in CHAINGPT_API_KEY, RPC, and deployed contract addresses
npm install
npm run dev
```

### Frontend
_(Scaffolded later in the week — see CLAUDE.md §10 Day 5.)_

## Testing
- Contracts: `forge test -vv` (unit + fuzz + invariant).
- Backend: manual `curl` / browser for now; see [`backend/README.md`](./backend/README.md).

## Security notes

- **Oracle override is a testnet demo feature.** The `HybridPriceOracle` exposes an owner-only `setManualOverride(asset, price)` so that the 4-minute demo video can deterministically reproduce a price drop. On an Arbitrum mainnet deployment this function would be removed or gated by a timelocked multisig. On-chain transactions and confidential balance updates themselves remain fully real. See [`CLAUDE.md` §6](./CLAUDE.md#6-oracle-strategy--the-hybrid-approach).
- **The relayer is non-custodial.** It holds no private keys and signs no user transactions. User view keys, when passed to the relayer to decrypt balances for alert context, are kept in memory only and never logged.

## What we built vs. what existed before
_(Finalize Day 6 — compare to prior iExec samples and to open DeFi lending.)_

## Team
Arthur Barraine — solo.

## License
MIT.
