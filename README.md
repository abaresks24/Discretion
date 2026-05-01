# Discretion — Confidential Lending Vault

> Submission to the iExec Vibe Coding Challenge (April 2026).
> Built on **iExec Nox (ERC-7984)** for confidential balances. Deployed on **Arbitrum Sepolia**.

---

## Problem

In open DeFi, every lending position is public: anyone can see collateral, debt, and LTV on-chain. Whales get front-run, strategies are copied, and positions become targets for coordinated liquidation attacks. Privacy is the missing primitive.

## Solution

A multi-collateral lending vault where **per-user collateral, debt, and LP shares are confidential** (ERC-7984 via iExec Nox), with:

- **Auto-routed entry / exit mixers** (`WrapQueue` / `UnwrapQueue`) that batch user wraps/unwraps via a TEE keeper, breaking the timing correlation between a plaintext token movement and the on-chain effect.
- **Live, public utilization-based interest rates** with a smooth log-shaped curve. Borrow APR == Supply APR (no protocol margin).
- A **ChainGPT AI copilot** that monitors position health, alerts on LTV drift, and suggests one-click remediation actions.

## Live deployment (Arbitrum Sepolia · `chainId 421614`)

| Contract | Address |
|---|---|
| `ConfidentialLendingVault` (v3.4) | `0xef8ebc2ccdae227d0a64ff5382065bef079a9cf3` |
| `HybridPriceOracle` | `0x427a6EAde8CBb4dD3796262D75b598aF366BfE76` |
| `WrapQueue` (RLC entry mixer) | `0x2A6Ab3eA4eEb4f69fAC934AC138f1B207989e23b` |
| `WrapQueue` (WETH entry mixer) | `0xEDF342fe6C9edB7d0CAcAf126f8951e124fC5006` |
| `WrapQueue` (USDC entry mixer) | `0x13d8D2F80C1A9c345b2dB0254b5BE166Ee9f6192` |
| `UnwrapQueue` (USDC exit mixer) | `0x451b42AcE634985e8861D52a788e88Bda0e46587` |

Asset registry:

| Symbol | Plaintext ERC-20 | Confidential ERC-7984 wrapper | Decimals | Max LTV | Mixer |
|---|---|---|---|---|---|
| RLC | `0x9923eD3cbd90CD78b910c475f9A731A6e0b8C963` | `0x92b23f4a59175415ced5cb37e64a1fc6a9d79af4` (cRLC) | 9 | 70% | yes |
| WETH | `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` | `0xD32Ca2A2e40BD5c0ba71C5170FbacE7F46BC7EC0` (cWETH) | 18 | 75% | yes |
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | `0x1ccec6bc60db15e4055d43dc2531bb7d4e5b808e` (cUSDC) | 6 | 75% | yes (exit mixer too) |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js + wagmi)                    │
│   /borrow · /lend · /mix · /manage · /liquidations · /admin      │
└──────────────────────────────────────────────────────────────────┘
                │ wallet sigs       │ reads + decryption requests
                ▼                   ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Arbitrum Sepolia        │   │  iExec Nox Gateway (off-chain)   │
│  (on-chain source of     │   │  Encrypts user inputs to         │
│  truth)                  │   │  euint256 handles + proofs.      │
│                          │   │  Decrypts user-owned handles     │
│  • LendingVault          │   │  on demand.                      │
│  • HybridPriceOracle     │   └──────────────────────────────────┘
│  • WrapQueue × 3                       ▲
│  • UnwrapQueue           │             │
└──────────────────────────┘             │
                ▲                        │
                │ keeper signs           │
                │ processBatch()         │
                │                        │
        ┌──────────────────────┐  ┌─────────────────────────────┐
        │  Backend relayer     │──▶│ ChainGPT (LLM)              │
        │  (Node.js + Fastify) │  └─────────────────────────────┘
        │  • Mixer keeper      │
        │  • Event watcher     │
        │  • /analyze /chat    │
        │  • /alerts (SSE)     │
        └──────────────────────┘
```

Three layers, strict separation:

1. **On-chain (Solidity 0.8.28).** Vault, oracle, mixer queues. The vault tracks per-user balances as encrypted handles, and per-asset / vault-wide aggregates as plaintext counters (`totalDebt`, `totalSupplied`).
2. **Backend relayer (Node.js + Fastify + viem).** Stateless. Hosts the **mixer keeper** (formerly an iExec TEE iApp — folded into the relayer for the hackathon, see §"Status" below) which polls the four queues every 30s and submits `processBatch`. Also exposes ChainGPT endpoints to the frontend.
3. **Frontend (Next.js 14 + wagmi v2 + viem v2).** Drives wallet, requests Nox encryption / decryption, signs vault transactions. Auto-routes wrapping through the mixer queue when a user's confidential balance is insufficient.

## Interest rate model

Borrow APR == Supply APR (no protocol margin). Both are derived live from utilization:

```
utilizationBps = totalDebt × 10_000 / totalSupplied        (0 if totalSupplied == 0)
```

The curve approximates a concave logarithm with a piecewise-linear function: steep slope near 0% to attract suppliers early, mild plateau through normal operating range, asymptote to 100% APR at exactly 100% utilization (only reached at the limit). Anchor points:

```
APR (%)
 100 ┤                                                                ╱
  90 ┤                                                              ╱
  80 ┤                                                            ╱  ← 99.99% util
  70 ┤                                                          ╱
  60 ┤                                                        ╱
  50 ┤                                                  ╱╱╱╱╱     ← 99.9% util
  40 ┤                                              ╱╱╱
  30 ┤                                          ╱╱╱
  25 ┤                                       ╱╱╱                  ← 99.5% util
  20 ┤                                    ╱╱╱
  15 ┤                                ╱╱╱╱                        ← 99% util
  10 ┤                          ─────╯                            ← 98% util
   9 ┤                       ───╯                                 ← 95% util
   7 ┤                ──────╯                                     ← 80% util
   4 ┤        ───────╯                                            ← 50% util
   1 ┤  ╱────╯                                                    ← 10% util
   0 ┼─╯
     ┼────┼────┼────┼────┼────┼────┼────┼────┼────┼─────────────────►
     0%   20%  40%  60%  80%  90%  95%  98%  99%  99.5%  99.9%  100%
                                                                 utilization
```

| Util | APR | Util | APR |
|---:|---:|---:|---:|
| 0 % | 0.00 % | 99 % | 15.00 % |
| 10 % | 1.00 % | 99.5 % | 25.00 % |
| 50 % | 4.00 % | 99.9 % | 50.00 % |
| 80 % | 7.00 % | 99.99 % | 80.00 % |
| 95 % | 9.00 % | 100 % | 100.00 % |
| 98 % | 10.00 % | | |

Implementation: 10 piecewise-linear segments inside `borrowRateBps()` — see `contracts/src/ConfidentialLendingVault.sol`. No `log` library required, monotonic and continuous at every breakpoint.

## How a user interacts with the protocol

### Supplying liquidity (lender)

1. User clicks **Supply 10 USDC** on `/lend`.
2. Frontend reads user's confidential cUSDC handle. Decrypts via Nox.
3. If cUSDC balance < 10 USDC → routes the wrap through the **USDC WrapQueue**:
    - approves underlying USDC → WrapQueue (one-time, unlimited);
    - calls `queueWrap(amount, user)`;
    - polls every 5s until the keeper batches the entry.
4. Keeper (in the backend relayer) calls `WrapQueue.processBatch([id])` → wrapper.wrap → `confidentialTransfer` → user's wallet receives encrypted cUSDC ≤30s later.
5. Frontend sets the vault as operator on cUSDC (one-time).
6. Calls `noxClient.encryptInput(amount, "uint256", VAULT_ADDRESS)` → handle + proof.
7. Calls `vault.supplyLiquidity(handle, proof, plainAmount)`. The vault:
    - pulls cUSDC via `confidentialTransferFrom`;
    - increments encrypted `_lenderShares[user]`;
    - increments plaintext `totalSupplied`;
    - grants persistent ACL on the new handle to user, owner, vault, and the liquidation operator.

### Borrowing

1. User locks collateral first via `/borrow` (same flow as Supply but on a different vault function).
2. Then clicks **Borrow 0.3 USDC**.
3. Frontend encrypts amount, calls `vault.borrow(handle, proof, plainAmount)`.
4. Vault's FHE LTV check (`_checkBorrowLtv`) sums `Σ collat_raw_i × price_i × ltv_bps_i` against `(currentDebt + amount) × scale`. If the check fails, the vault silently caps the transferred amount to 0 (preserves privacy — no on-chain revert leaks "user is over-LTV").
5. cUSDC is sent to the user's wallet (encrypted).
6. `totalDebt` is incremented by `plainAmount`.

The frontend's UI gate: the **Borrow** button greys out client-side when `amount + debt > weighted capacity` so users get a deterministic UX before triggering the on-chain check.

### Exit (claim plaintext USDC after a borrow)

`/mix` shows the four queues, their pending counts, an aggregate **privacy score**, and a countdown to the next batch. To exit a confidential balance to plaintext, the user goes to `/mix` and queues an unwrap on `UnwrapQueue` for cUSDC; the same backend keeper batches it.

## Status / hackathon scope

| Originally planned | Status |
|---|---|
| WrapQueue (RLC) | deployed |
| WrapQueue (WETH, USDC) | deployed (added during hackathon to extend mixer to all assets) |
| UnwrapQueue (USDC) | deployed |
| iExec TEE iApp keeper | scaffolded in `tee-app/discretion-mixer/`. Replaced by an in-relayer keeper for the hackathon (Node.js script with the operator key in `.env`). The contract operator role is rotatable, so the iApp can take over without redeploying anything. |
| Plaintext aggregate counters | added (`totalDebt`, `totalSupplied`). Required to compute live, public utilization without revealing per-user balances. The trade-off — the user passes the plain amount alongside the encrypted handle and the contract trusts it for accounting — is documented in `ConfidentialLendingVault.sol`. Production would FHE-verify equality via `Nox.eq`. |
| Logarithmic / concave rate curve | implemented (piecewise-linear, see above) |
| Vault `_grantAudit` includes `address(this)` | fixed mid-hackathon. Without this, `_checkBorrowLtv` reverted with `NotAllowed(handle, vault)` because the vault didn't have persistent ACL on its own stored handles. |
| ChainGPT alerts + SSE | scaffolded; demo |
| Frontend public APR / util | shown on `/lend` and `/borrow` even without a connected wallet, so visitors can size up the protocol before clicking *Connect*. |

## Tech stack

| Layer | Stack |
|---|---|
| Contracts | Solidity `^0.8.28`, Foundry, iExec Nox (`@iexec-nox/nox-protocol-contracts`, `@iexec-nox/nox-confidential-contracts`), OpenZeppelin |
| Backend | Node.js 20, Fastify, viem, `@chaingpt/generalchat`, SSE, pino |
| Frontend | Next.js 14 (App Router), TypeScript strict, wagmi v2, viem v2, `@iexec-nox/handle`, Tailwind, custom terminal-style primitives |
| TEE iApp | iExec iApp framework (Intel TDX), Docker, `@iexec/iapp` CLI |
| Infra | Arbitrum Sepolia (`chainId 421614`) |

## Local setup

### Prerequisites
- Node.js 20+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- An EVM wallet funded on Arbitrum Sepolia
- A ChainGPT API key

### Contracts
```bash
cd contracts
npm install                 # iExec Nox solidity libs (npm-distributed)
forge install               # forge-std + chainlink-brownie-contracts
cp .env.example .env        # fill in DEPLOYER_PRIVATE_KEY + RPC
forge build
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
```

For the additional WrapQueues (WETH, USDC) added mid-hackathon:
```bash
forge script script/DeployExtraQueues.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```

To redeploy the vault only (keeping oracle, queues, cTokens):
```bash
forge script script/RedeployVault.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast
```

### Backend (relayer + mixer keeper)
```bash
cd backend
npm install
cp .env.example .env        # fill in CHAINGPT_API_KEY, contract addresses, MIXER_OPERATOR_PRIVATE_KEY
npm run dev
```

Bootstrap the mixer operator (rotates the on-chain operator role to a fresh keypair and funds it):
```bash
npx tsx scripts/bootstrap-mixer.ts
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # fill in vault + queue addresses (NEXT_PUBLIC_*)
npm run dev
```

`http://localhost:3000` — landing → `/app/borrow`, `/app/lend`, `/app/mix`, `/app/manage`.

## Privacy properties

What stays private:
- Per-user collateral balance (per asset)
- Per-user debt
- Per-user LP shares
- The amount inside any individual `confidentialTransfer` / `confidentialTransferFrom`

What is public (by design):
- Aggregate `totalDebt` and `totalSupplied`
- Per-asset oracle prices
- Utilization, borrow APR, supply APR
- That a given address interacted with the vault (event participation), but not amounts

What the entry / exit mixers add:
- Timing decorrelation between a plaintext deposit and the resulting cToken credit (or vice versa). The `Queued` event still reveals the amount; for full amount privacy you would pair this with ZK commitments or move the queue itself into ERC-7984 internal accounting.

## Security notes

- **Oracle override is a testnet demo feature.** The `HybridPriceOracle` exposes an owner-only `setManualOverride(asset, price)` so that demo videos can reproduce a price drop. In a mainnet deployment this function would be removed or gated by a timelocked multisig.
- **The relayer is non-custodial for user funds.** It holds the mixer **operator** key (rotatable) which can call `processBatch` on the queues — that operator never custodies user funds: it only triggers a wrap of plaintext that the user already deposited, with destinations that the user already chose at `queueWrap` time.
- **`plainAmount` parameter is trust-based** at the hackathon stage. A malicious frontend could lie about the plain amount to under/over-state the global utilization. Production would FHE-verify equality with the encrypted amount before applying it to the public counter.

## License
MIT.
