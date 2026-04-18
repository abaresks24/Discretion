# CLAUDE.md

> This file is the operating manual for Claude Code on this repository.
> Read it fully at the start of every session. It is the source of truth for what we're building, why, and how.

---

## 1. Project Summary

**Codename:** `TBD` (placeholder — see §14 for naming shortlist)

**Context:** Submission to the **iExec Vibe Coding Challenge** (April 2026). Must be delivered within ~1 week. Hackathon rules, partners, and prizes are summarized in §2.

**One-line pitch:** A private on-chain lending/borrowing vault where collateral and debt are confidential (ERC-7984 via iExec Nox), paired with a ChainGPT AI copilot that monitors position health, alerts on LTV drift, and suggests concrete remediation actions (partial/full repay, add collateral, withdraw collateral).

**Why this angle:**
- Aligns with two of iExec's five explicit builder ideas: "Confidential Vault" and "Private Lending/Borrowing"
- Requires only **ERC-7984** (provided natively by Nox) — no partial ERC-3643 or ERC-7540 implementation (rules explicitly disqualify partial standard implementations)
- ChainGPT integration is **functionally non-trivial** (not a decorative chatbot): risk analysis, scenario simulation, action recommendations computed from live on-chain state
- Demo is controllable end-to-end thanks to a hybrid oracle with manual override (see §6)

---

## 2. Hackathon Constraints (Hard Rules)

These are direct quotes/paraphrases from the brief. Violating any of them = disqualification or score penalty.

| # | Rule | Impact on code |
|---|------|----------------|
| 1 | **Deploy on Arbitrum Sepolia or Arbitrum mainnet** | All contracts target `arbitrumSepolia` chainId 421614 |
| 2 | **No mock data — application must work end-to-end** | No hardcoded balances, no fake RPC responses, all transactions real |
| 3 | **Must integrate Confidential Tokens via Nox** | ERC-7984 tokens for at least collateral and debt balances |
| 4 | **Confidential Token must have a concrete utility** | In this project: private payments (balances) + in-app currency (debt/collateral accounting) |
| 5 | **No partial implementation of ERC-3643, ERC-7540, ERC-7984** | We implement ERC-7984 through Nox's library (full compliance) and do NOT claim any other standard |
| 6 | **`feedback.md` required in repo root** | Maintained throughout the week, not last-minute |
| 7 | **Demo video ≤ 4 minutes** | See §12 for storyboard |
| 8 | **Public GitHub repo + README + install instructions** | README structured per §13 |
| 9 | **Submission via X post tagging `@iEx_ec` and `@Chain_GPT`** | Post drafted in `submission/x-post.md` |

**Evaluation weights (from the brief):**
- ⭐⭐⭐ End-to-end functionality (no mocks) — strongest weight
- ⭐⭐ Deployment on Arbitrum Sepolia/Arbitrum
- ⭐⭐ `feedback.md` present
- ⭐⭐ Video ≤ 4 min
- ⭐ Technical use of Confidential Tokens & Nox
- ⭐ Real-world RWA/DeFi relevance
- ⭐ Code quality
- ⭐ UX

Design decisions throughout this repo should maximize the ⭐⭐⭐ criterion first, ⭐⭐ criteria second.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Position     │  │ AI Copilot     │  │ Actions Panel   │  │
│  │ Dashboard    │  │ (ChainGPT chat │  │ (repay, add     │  │
│  │ (LTV, HF)    │  │  + suggestions)│  │  collat, etc.)  │  │
│  └──────┬───────┘  └────────┬───────┘  └─────────┬───────┘  │
│         │                   │                     │          │
│         │         ┌─────────┴──────────┐          │          │
│         │         │ wagmi / viem       │          │          │
│         │         │ (wallet + reads)   │          │          │
│         │         └─────────┬──────────┘          │          │
└─────────┼───────────────────┼─────────────────────┼──────────┘
          │                   │                     │
          │                   ▼                     │
          │         ┌──────────────────┐            │
          │         │ Backend Relayer  │            │
          │         │ (Node.js)        │            │
          │         │ - /analyze       │            │
          │         │ - /alerts (SSE)  │            │
          │         │ - /chat          │            │
          │         └────┬─────────┬───┘            │
          │              │         │                │
          │              ▼         ▼                │
          │     ┌────────────┐  ┌──────────┐        │
          │     │ ChainGPT   │  │ Event    │        │
          │     │ API (LLM)  │  │ watcher  │        │
          │     └────────────┘  └─────┬────┘        │
          │                           │             │
          ▼                           ▼             ▼
┌────────────────────────────────────────────────────────────┐
│               ARBITRUM SEPOLIA (on-chain)                   │
│                                                              │
│  ┌────────────────────────┐    ┌──────────────────────┐    │
│  │ HybridPriceOracle.sol  │    │ ConfidentialLending  │    │
│  │ - Chainlink fallback   │◄──►│ Vault.sol            │    │
│  │ - Manual override      │    │ (ERC-7984 via Nox)   │    │
│  └────────────────────────┘    └──────────┬───────────┘    │
│                                            │                │
│                                            ▼                │
│                                ┌──────────────────────┐    │
│                                │ LiquidationEngine    │    │
│                                │ (simple, same file   │    │
│                                │  OK for MVP)         │    │
│                                └──────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

**Three layers, strict separation:**
1. **On-chain:** Solidity contracts, deployed on Arbitrum Sepolia. Source of truth for positions.
2. **Backend relayer (Node.js):** stateless orchestrator that watches on-chain events, calls ChainGPT, exposes endpoints to the frontend. **Never holds user funds. Never signs user transactions.**
3. **Frontend (Next.js + wagmi):** user interface. Signs transactions with user wallet directly.

---

## 4. Tech Stack (Pinned Decisions)

### Smart contracts
- **Language:** Solidity `^0.8.24`
- **Framework:** Foundry (forge/anvil/cast) — faster than Hardhat for hackathon iteration
- **Testing:** forge test with fuzzing on core math (LTV, health factor, liquidation threshold)
- **Deploy target:** Arbitrum Sepolia (chainId `421614`)
- **Confidential layer:** iExec Nox library for ERC-7984 — **exact package names and import paths to be confirmed during/after the Nox "Hello World" workshop on April 17, 17:00 GMT+2**. Update this section once confirmed.
- **Key references to check at session start:**
  - https://docs.iex.ec/nox-protocol/getting-started/welcome
  - https://www.npmjs.com/org/iexec-nox?activeTab=packages
  - https://cdefi-wizard.iex.ec/ (confidential DeFi wizard — may generate a useful scaffold)
  - https://cdefi.iex.ec/ (demo + faucet)

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Wallet / chain:** `wagmi` v2 + `viem` v2
- **UI:** Tailwind CSS + shadcn/ui
- **State:** React Server Components where possible, `useState`/`useReducer` on client

### Backend relayer
- **Runtime:** Node.js 20+
- **Framework:** Fastify (lighter than Express, enough for this)
- **ChainGPT SDK:** `@chaingpt/generalchat` (NPM)
- **Event watcher:** viem `watchContractEvent` / `watchBlocks`

### ChainGPT
- **Which API:** Web3 AI Chatbot & LLM (`@chaingpt/generalchat`). Not the Auditor, not the NFT generator.
- **Why this one:** has live on-chain data access, can be given custom context (our user's position), supports structured JSON output for action suggestions.
- **Credits:** contact `@vladnazarxyz` on Telegram for free hackathon credits (mentioned in iExec brief).
- **Pricing safety net:** ~$0.005 per standard call → budget of $1-2 for the whole hackathon is more than enough.

### Deployment / hosting
- **Contracts:** Arbitrum Sepolia via Foundry scripts
- **Frontend:** Vercel (free tier)
- **Backend relayer:** Railway or Render (free tier)
- **RPC:** Arbitrum Sepolia public RPC + Alchemy fallback

---

## 5. Smart Contract Design

### 5.1 `HybridPriceOracle.sol`

Purpose: provides a price feed with **two modes**. Default: read from Chainlink feed. Demo/override: return a manually-set price.

```solidity
interface IHybridPriceOracle {
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt);
    function setManualOverride(address asset, uint256 price) external; // onlyOwner
    function clearManualOverride(address asset) external;              // onlyOwner
    function isOverridden(address asset) external view returns (bool);
}
```

**Design notes:**
- `price` is always in 8 decimals (Chainlink convention), regardless of whether it comes from Chainlink or the override.
- `updatedAt` returns `block.timestamp` for overridden prices and the feed's `updatedAt` otherwise.
- The override is **not a cheat** — it is documented in the README as a testnet demo feature, and in production this contract would be swapped for a non-owned Chainlink-only oracle. This is the same pattern that real protocols use on testnets.
- Staleness check: if non-overridden and `updatedAt < block.timestamp - STALENESS_THRESHOLD`, revert. Required for safety.

### 5.2 `ConfidentialLendingVault.sol`

Purpose: core lending logic. Holds collateral, issues debt, computes health factor — all using ERC-7984 confidential amounts.

**Supported assets (MVP):**
- Collateral: 1 asset (WETH on Arbitrum Sepolia, or testnet equivalent)
- Debt: 1 asset (USDC on Arbitrum Sepolia, wrapped into a confidential variant)

**Key constants:**
```solidity
uint256 public constant LTV_MAX_BPS = 7500;              // 75% max LTV to borrow
uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8500; // 85% LTV triggers liquidation
uint256 public constant LIQUIDATION_BONUS_BPS = 500;      // 5% bonus to liquidators
uint256 public constant BPS_DENOMINATOR = 10000;
```

**Public functions:**
```solidity
function depositCollateral(uint256 amount) external;
function withdrawCollateral(uint256 amount) external;
function borrow(uint256 amount) external;
function repay(uint256 amount) external;
function liquidate(address user, uint256 repayAmount) external;
```

**View functions (confidential reads):**
```solidity
function getEncryptedCollateral(address user) external view returns (bytes32);
function getEncryptedDebt(address user) external view returns (bytes32);
// Health factor is ALSO confidential — user decrypts client-side with their key
function getEncryptedHealthFactor(address user) external view returns (bytes32);
```

**⚠️ Critical implementation note — confidential arithmetic:**
ERC-7984 amounts are not `uint256`; they are **ciphertext pointers (`bytes32`)** / encrypted types (`euint64`). Operations like `newDebt = oldDebt + borrowAmount` must go through the FHE/Nox library's operators (e.g., `FHE.add`, `FHE.lt`). The LTV check `debt * 1e18 / collateralValue < LTV_MAX` needs to happen **on encrypted operands**, with the comparison result being either:
- an encrypted boolean that the contract then uses via conditional select (`FHE.select`), or
- an off-chain decrypted assertion with a proof posted back on-chain.

**This is the single biggest technical unknown in the project.** The Nox "Hello World" workshop (April 17) must clarify:
1. How to do encrypted `<` and `>=` comparisons inside a contract
2. How to branch logic (revert vs proceed) based on encrypted booleans
3. Where the Gateway / Relayer comes in for decryption round-trips

Until this is clarified, code the vault with **placeholder encrypted types** and mark every arithmetic line with `// FIXME(nox): replace with FHE op`.

**Events (non-confidential — emitted for indexing and alerts):**
```solidity
event CollateralDeposited(address indexed user);
event CollateralWithdrawn(address indexed user);
event Borrowed(address indexed user);
event Repaid(address indexed user);
event Liquidated(address indexed user, address indexed liquidator);
event HealthFactorThresholdCrossed(address indexed user, uint8 newZone); // 0=safe, 1=warning, 2=danger, 3=liquidatable
```

Note that events do NOT leak amounts — only the fact that something happened. The `HealthFactorThresholdCrossed` event is intentional: it lets the backend relayer trigger alerts without decrypting balances.

### 5.3 Liquidation logic (MVP simplification)

- Anyone can call `liquidate(user, repayAmount)`.
- Liquidation succeeds only if the user's health factor is below `LIQUIDATION_THRESHOLD`.
- Liquidator repays part of debt, receives collateral + `LIQUIDATION_BONUS_BPS`.
- For MVP: no partial liquidations with complex waterfall — either full close or up to the bonus-adjusted cap.

---

## 6. Oracle Strategy — The Hybrid Approach

**Decision (locked):** hybrid oracle with Chainlink feed as default and owner-only manual override.

**Rationale:**
- Using Chainlink alone on Arbitrum Sepolia is risky: feeds may be stale, heartbeats are infrequent on testnet, and demo timing depends on real market moves (uncontrollable during the 4-minute video).
- Pure manual oracle (no Chainlink) looks less professional and signals "mock data" to judges.
- Hybrid = best of both: real Chainlink integration demonstrates competence, override guarantees a controllable demo.

**Documentation must be explicit** in the README:
> "The price oracle supports a manual override for testnet demonstration purposes, controlled by the deployer account. In a production deployment on Arbitrum mainnet, this override function would be removed or gated by a multisig with timelock. The override exists solely to allow reproducible demo scenarios — on-chain transactions and balance updates remain fully real."

**Demo sequence to pre-script:**
1. Start with ETH = $3,000 (realistic)
2. User deposits 1 WETH, borrows 2,000 USDC → LTV ≈ 67% (safe but visible)
3. Manually push ETH to $2,500 → LTV recalculates to ~80%, crosses warning zone
4. ChainGPT alert fires → suggests repaying 500 USDC OR adding 0.2 WETH collateral
5. User accepts suggestion → LTV returns to safe zone
6. Push ETH to $2,100 briefly to show what liquidation zone looks like, then recover

---

## 7. ChainGPT Integration

### 7.1 What ChainGPT does in this app
Three distinct jobs, same underlying SDK (`@chaingpt/generalchat`):

**A. Contextual alert generation.** When a position crosses a threshold (triggered by `HealthFactorThresholdCrossed` event or by a price tick watcher), the backend composes a structured prompt including: asset prices, user's collateral amount (decrypted via their view key passed from frontend), debt, LTV, time since last rebalance. ChainGPT returns a natural-language alert + a structured suggestion.

**B. Free-form Q&A chat.** User can ask questions like "what happens if ETH drops to 2400?" or "can I borrow 500 more without risk?". Same SDK, but system prompt is different and user message is raw. Response streamed back to the UI.

**C. Actionable suggestions.** Every alert and every chat response can end with a structured JSON block like:
```json
{
  "suggested_actions": [
    { "type": "repay", "amount_usdc": 500, "expected_new_ltv_bps": 6200 },
    { "type": "add_collateral", "amount_weth": "0.2", "expected_new_ltv_bps": 6400 }
  ]
}
```
The frontend parses this and renders clickable action cards. User confirms → wagmi signs → contract call.

### 7.2 System prompt (draft — refine in Week)

```
You are the risk copilot for a confidential lending vault on Arbitrum.
You receive the user's current position state as structured JSON and must:
1. Produce a ONE-SENTENCE status summary in plain English.
2. If LTV > 70%, produce an alert with severity (info / warning / danger).
3. ALWAYS end your response with a JSON block `suggested_actions` listing at most 3 actionable, numerically concrete suggestions (type + amount + expected LTV after action).
You must compute expected LTVs correctly based on oracle prices provided in context.
Be direct, no fluff, no disclaimers about "not financial advice".
```

### 7.3 What ChainGPT does NOT do
- **Never signs transactions.** Only the user signs.
- **Never holds private keys or view keys.** View keys for decryption are passed per-request from the user's client.
- **Never stores user positions.** Every request is stateless.
- **Never auto-executes.** The user must click to confirm every action.

This keeps the security model clean and matches the "non-custodial, user-controlled" philosophy expected in DeFi.

---

## 8. Frontend Design (Next.js)

### 8.1 Pages
- `/` — landing page with short pitch + "Enter App" CTA
- `/app` — main dashboard (the one shown in the demo)
- `/app/public-view` — "what everyone else sees about you on-chain" → empty, showcases privacy
- `/about` — tech stack, architecture diagram, feedback.md rendered

### 8.2 Main dashboard layout
- **Left column:** position card (collateral, debt, LTV gauge, health factor)
- **Middle column:** action panel (deposit/borrow/repay/withdraw buttons, with amounts)
- **Right column:** AI copilot (chat thread + alert banner when triggered + suggestion cards)

### 8.3 Critical UX details for wow-factor
- LTV gauge with color zones (green <60%, yellow 60-75%, orange 75-85%, red >85%)
- Animated transitions when LTV changes after an action
- A "Public View" button that switches to `/app/public-view` to demonstrate that nobody else sees anything
- Alert banner slides in from top when ChainGPT returns a warning, with "Apply suggestion" one-click buttons

### 8.4 What NOT to build (scope discipline)
- No charts of historical prices (unnecessary for MVP)
- No multi-user leaderboard
- No KYC / identity flow
- No mobile responsive design (desktop demo only)
- No dark/light toggle (pick one look and commit)

---

## 9. Backend Relayer

### 9.1 Endpoints
- `POST /analyze` — takes `{ userAddress, viewKey }`, fetches on-chain state, decrypts with view key, calls ChainGPT, returns structured analysis
- `POST /chat` — takes `{ userAddress, viewKey, message, history }`, calls ChainGPT in conversational mode, streams response
- `GET /alerts/:userAddress` (SSE) — pushes alerts when position thresholds are crossed
- `GET /health` — simple health check

### 9.2 Event watcher
- Subscribes to `HealthFactorThresholdCrossed` events on the vault contract
- On each event: looks up last known view key for that user (pushed from frontend on connection), fetches state, calls ChainGPT, pushes alert via SSE
- Also polls oracle price every 10s as a backup trigger (catches cases where price moves but no tx happens)

### 9.3 Security notes
- **View keys MUST NOT be logged.** Log redaction required on every endpoint.
- **No persistent storage of view keys.** In-memory only, evicted after session close.
- **Rate limiting per IP** to prevent abuse of ChainGPT credits.

---

## 10. Day-by-Day Plan (7 days)

### Day 1 (Thursday evening → Friday) — Setup & Nox foundations
- [ ] Join iExec Discord, Vibe Coding channel
- [ ] **ATTEND: Nox "Hello World" workshop — April 17, 17:00 GMT+2** (CRITICAL)
- [ ] Contact `@vladnazarxyz` on Telegram for ChainGPT credits
- [ ] Get Arbitrum Sepolia ETH from faucet
- [ ] Init Foundry project, verify deploys work
- [ ] Init Next.js + wagmi, verify wallet connection on Arbitrum Sepolia
- [ ] Wrap/unwrap one ERC-20 into ERC-7984 via Nox — **working end-to-end**
- [ ] Update §4 and §5.2 with confirmed Nox package names and FHE operation patterns
- [ ] Start `feedback.md` with day-1 observations

### Day 2 — Oracle + vault skeleton
- [ ] `HybridPriceOracle.sol` with Chainlink + override, unit tested
- [ ] `ConfidentialLendingVault.sol` skeleton: deposit, withdraw, events — no borrow yet
- [ ] Confidential balance tracking working end-to-end for collateral
- [ ] First frontend page: connect wallet, deposit, see private balance
- [ ] **Checkpoint: can I deposit collateral and see my confidential balance? Yes/No**

### Day 3 — Borrow + health factor + liquidation
- [ ] Borrow/repay logic with encrypted arithmetic
- [ ] Health factor computation (encrypted, decryptable client-side)
- [ ] `HealthFactorThresholdCrossed` event emission on zone crossings
- [ ] Simple liquidation function
- [ ] Full flow test: deposit → borrow → price drop → liquidation reverts / succeeds correctly
- [ ] **Checkpoint: can I run a full lending cycle on testnet? Yes/No**

### Day 4 — ChainGPT integration
- [ ] Backend relayer scaffold with Fastify
- [ ] `/analyze` endpoint calling ChainGPT with structured prompt
- [ ] Frontend renders alerts and suggestion cards
- [ ] Free-form chat integration
- [ ] Event watcher + SSE alert pipeline
- [ ] **Checkpoint: does a real position change trigger a real ChainGPT alert? Yes/No**

### Day 5 — Polish + public view + action flow
- [ ] One-click "Apply suggestion" button that actually signs the tx
- [ ] `/app/public-view` page
- [ ] LTV gauge animation, zone transitions
- [ ] Error handling (tx rejected, RPC down, ChainGPT timeout)
- [ ] Loading states everywhere
- [ ] **Checkpoint: could I hand the app to a stranger and have them use it? Yes/No**

### Day 6 — Deployment + docs + video
- [ ] Final deploy on Arbitrum Sepolia (fresh addresses)
- [ ] Deploy frontend on Vercel, backend on Railway
- [ ] Write README per §13
- [ ] Finalize `feedback.md` with full week's observations on iExec tools
- [ ] Script and record 4-minute demo video (see §12)
- [ ] **Checkpoint: is the video the last thing missing? Yes/No**

### Day 7 — Submission + buffer
- [ ] Re-watch video, re-record if needed
- [ ] Draft X post per §13
- [ ] Verify all links (repo, video, frontend, backend)
- [ ] Post on X with `@iEx_ec` and `@Chain_GPT` tags
- [ ] Post link in iExec Discord channel

---

## 11. Testing Strategy

### Smart contracts
- **Unit tests (Foundry):** every public function, boundary cases on LTV math
- **Fuzz tests:** on `deposit/borrow/repay/withdraw` with random amounts
- **Invariant tests:** total collateral value ≥ total debt value × LTV_MAX (when no one is liquidatable)
- **Scenario tests:** end-to-end flows including liquidation

### Frontend
- **Manual testing** only (no Playwright for time reasons)
- Test matrix: Metamask on desktop Chrome + Rabby on desktop Chrome

### Integration
- Deployed copy on Arbitrum Sepolia from day 2 onwards, retested end-of-day

---

## 12. Demo Video Storyboard (4 minutes max)

| Time | What's on screen | What's said (EN) |
|------|------------------|------------------|
| 0:00–0:15 | Logo + one-liner overlay on block explorer showing a whale's public position | "In DeFi, everyone sees how much you've borrowed. Whales get front-run, strategies get copied, positions get targeted. Privacy is the missing piece." |
| 0:15–0:40 | Quick architecture diagram (from §3) | "We built a confidential lending vault on iExec's Nox, with an AI copilot from ChainGPT that watches your position 24/7." |
| 0:40–1:30 | App walkthrough: connect wallet, deposit WETH, borrow USDC | "Everything you see is real — Arbitrum Sepolia, real transactions. Watch the block explorer on the right: amounts are encrypted." |
| 1:30–2:30 | **The wow moment**: trigger price drop via oracle override | "Now watch what happens when ETH dips." → LTV gauge turns red → ChainGPT alert slides in → "Repay 500 USDC to restore safety" → user clicks → position returns to safe zone. |
| 2:30–3:15 | Free-form chat: "What if ETH drops to 2000?" | Show ChainGPT's structured response with scenario analysis and actionable suggestions. |
| 3:15–3:45 | Public view page — empty | "And here's what everyone else on-chain sees about this user: nothing. No balance, no debt, no strategy." |
| 3:45–4:00 | Logo + GitHub link + tags | "Private, auditable, composable. Built on Nox and ChainGPT. Link in bio." |

---

## 13. Deliverables Checklist

### Required by iExec
- [ ] Public GitHub repo with full open-source code
- [ ] README with installation + usage instructions
- [ ] Comprehensive docs on setup/deployment
- [ ] Functional frontend
- [ ] Demo video (≤ 4 min)
- [ ] Deployed on Arbitrum Sepolia or Arbitrum
- [ ] `feedback.md` on iExec tools experience
- [ ] X post with short description + video + repo link, tagging `@iEx_ec` and `@Chain_GPT`

### README skeleton
```
# <Project Name>

One-liner pitch.

## Problem
## Solution
## Architecture diagram
## Live demo
- Frontend: <vercel URL>
- Contract addresses (Arbitrum Sepolia): ...
- Demo video: <YouTube/Loom URL>

## How it works
## Tech stack
## Local setup
### Prerequisites
### Install
### Run contracts
### Run backend
### Run frontend
## Testing
## Security notes (incl. oracle override explanation)
## What we built vs what existed before
## Team
## License
```

### X post template (draft — finalize Day 7)
```
🔒 Introducing <name>: the first confidential lending vault with an AI copilot.

Built on @iEx_ec Nox (ERC-7984) + @Chain_GPT
→ Private collateral & debt balances
→ Real-time LTV monitoring with AI alerts
→ One-click repay / add collateral suggestions

Live on Arbitrum Sepolia 👇
[demo video]
[GitHub link]

#iExec #ChainGPT #ConfidentialDeFi
```

---

## 14. Naming Shortlist (pick Day 2)
- **Noxus** — blends "Nox" + Latin "nexus"; dark-but-refined
- **Obscura** — "hidden" in Latin, premium feel
- **Shroud** — English, shorter, easy to remember
- **Umbra** — "shadow", short and evocative
- **Veil** — simple, privacy-native
- **Private Vault** / **PrivLend** — descriptive, low creativity but clear

Pick one on Day 2 before branding work starts. Domain and Twitter handle availability matter less than visual identity.

---

## 15. Open Questions / Unknowns

These must be resolved during Day 1 (workshop + docs review):

1. **Exact Nox package names** on NPM and Solidity imports — fill in §4 and §5.2
2. **How to do encrypted comparisons** (`<`, `>=`) inside a Solidity contract using Nox/FHE — critical for LTV checks
3. **Whether Gateway/Relayer round-trip is needed** for decryption of health factor views — affects UX latency
4. **Chainlink feed availability** for ETH/USD on Arbitrum Sepolia — fallback is Pyth or manual oracle
5. **ChainGPT rate limits** on free tier — determines whether event-triggered alerts need throttling

---

## 16. Non-Goals (explicitly out of scope)

- Multi-collateral, multi-debt-asset support
- Variable interest rates / interest accrual over time (MVP uses a flat rate or zero)
- Governance, tokenomics, protocol fees
- Mobile-responsive UI
- Historical charts or analytics dashboards
- Any claim of ERC-3643 or ERC-7540 compliance
- KYC or identity verification
- Multi-chain deployment
- Production-grade monitoring (Grafana, Sentry, etc.)
- Formal security audit (ChainGPT auditor is not integrated in this project per Arthur's scope decision)

---

## 17. Code Style & Conventions

### Solidity
- NatSpec on every public/external function
- Custom errors (not `require` strings)
- Checks-effects-interactions pattern strictly
- No inline assembly unless justified in a comment
- Use `unchecked { ... }` only for proven-safe arithmetic (document why)

### TypeScript
- `strict: true` in tsconfig
- No `any` (use `unknown` + narrowing)
- Functional components, hooks
- Prefer server components where data is static

### Commits
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- Small commits, one concern each
- Every contract change references the CLAUDE.md section it updates

### PRs
- Not applicable (solo project, commit to main)
- But: end-of-day self-review before `git push` to ensure no secrets leaked

---

## 18. Secrets & Environment

`.env.local` (frontend and backend, never committed):
```
NEXT_PUBLIC_VAULT_ADDRESS=
NEXT_PUBLIC_ORACLE_ADDRESS=
NEXT_PUBLIC_USDC_CONFIDENTIAL_ADDRESS=
NEXT_PUBLIC_WETH_CONFIDENTIAL_ADDRESS=
NEXT_PUBLIC_RELAYER_URL=
NEXT_PUBLIC_CHAIN_ID=421614

# Backend only
CHAINGPT_API_KEY=
ARBITRUM_SEPOLIA_RPC=
ORACLE_OVERRIDE_PRIVATE_KEY= # only for demo scripts, NEVER in prod frontend
```

`.gitignore` must include: `.env*`, `broadcast/`, `cache/`, `out/`, `node_modules/`, `.next/`, `.DS_Store`.

---

## 19. Rules for Claude Code (in this repo)

- **Always re-read this CLAUDE.md at session start.** Conventions evolve.
- **Never skip the "Checkpoint" questions** at the end of each day — they're gates, not decorations.
- **Never implement a new standard (ERC-xxxx) without confirming rule 5 from §2.** Partial implementations disqualify the submission.
- **Never mock data.** If a real value isn't available, stop and ask Arthur — don't invent.
- **When in doubt about Nox specifics, check the workshop recording / docs / Discord before writing code.**
- **Keep `feedback.md` updated** as you work, not at the end.
- **If a task takes > 2 hours of debugging on a Nox-specific issue, stop and ask in the iExec Discord.** Don't burn the week on one silent bug.

---

*End of CLAUDE.md — keep this file in sync with reality as the project evolves.*
