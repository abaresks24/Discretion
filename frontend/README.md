# Discretion — Frontend

Next.js 14 (App Router, TypeScript strict, Tailwind) — the editorial-luxury UI described in the frontend brief.

## Structure

```
frontend/
├── app/
│   ├── layout.tsx            — root layout, font loading, providers
│   ├── providers.tsx         — wagmi + TanStack Query + ViewMode + ViewKey
│   ├── globals.css           — design tokens, type scale, editorial helpers
│   ├── page.tsx              — landing hero
│   ├── app/
│   │   ├── layout.tsx        — PageHeader wrapper
│   │   ├── page.tsx          — dashboard (behind WalletGate)
│   │   └── public-view/page.tsx
│   ├── about/page.tsx        — editorial long-form
│   └── sandbox/page.tsx      — isolated component preview (review-only)
├── components/
│   ├── Logo.tsx, DiscretionMark
│   ├── GoldHairline.tsx
│   ├── DecryptedNumber.tsx   — canonical confidential-value display
│   ├── StatusPill.tsx, LtvGauge.tsx
│   ├── Card.tsx              — 8px radius, 1px border, no shadow
│   ├── PositionCard, AllocatePanel, CounselPanel
│   ├── CounselMessage, SuggestionCard, ChatInput
│   ├── PageHeader
│   ├── WalletGate            — connect + one-time view-key signature
│   ├── LandingHero + GlobeBackdrop (globe.gl, off-axis décor)
│   └── Dashboard, PublicView
├── hooks/
│   ├── useDecryptText.ts     — 700ms scramble, veils on `public` mode
│   ├── usePosition.ts        — wagmi reads against the vault
│   └── useCounsel.ts         — chat + SSE alerts + gentle pulse
├── context/
│   ├── ViewModeContext.tsx   — private | public
│   └── ViewKeyContext.tsx    — in-memory session key
└── lib/
    ├── env.ts, wagmi.ts, cn.ts, format.ts
    ├── relayer.ts            — /analyze, /chat (streamed), /alerts (SSE)
    └── abi/vault.ts
```

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in contract + relayer addresses
npm run dev
```

Open `http://localhost:3000`. The `/sandbox` route previews every atomic component in isolation — use it for visual review before polishing.

## Design tokens

All tokens live in `tailwind.config.ts`. **Only one accent visible per screen at a time** — either gold for an action or a zone color for status, never both. No shadows. No saturated colors. See the brief for the discipline rules.

## Environment

`.env.local`:

```
NEXT_PUBLIC_VAULT_ADDRESS=0x…
NEXT_PUBLIC_ORACLE_ADDRESS=0x…
NEXT_PUBLIC_USDC_CONFIDENTIAL_ADDRESS=0x…
NEXT_PUBLIC_WETH_CONFIDENTIAL_ADDRESS=0x…
NEXT_PUBLIC_COLLATERAL_ASSET=0x…
NEXT_PUBLIC_DEBT_ASSET=0x…
NEXT_PUBLIC_RELAYER_URL=http://localhost:8787
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
```

## Post-workshop TODO (Day 2)

- [ ] Replace `placeholderDecrypt` in `hooks/usePosition.ts` with a relayer call that routes through the Nox Gateway for real FHE decryption.
- [ ] Swap the `bytes32` ABI inputs on `depositCollateral`/`borrow`/etc. for the real Nox `externalEuint64 + bytes` encrypted-input encoding, and update `Dashboard.handleAllocate` accordingly.
- [ ] Confirm the view-key signature scheme (`VIEW_KEY_MESSAGE`) matches whatever the Nox Gateway expects for per-user ACL grants.

## Deploy

Vercel free tier. Root directory `frontend/`. Build command `npm run build`, output `.next`.
