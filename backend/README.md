# Backend Relayer

Fastify server that bridges the `ConfidentialLendingVault`, ChainGPT, and the frontend. **Stateless, non-custodial, never signs transactions.** See [`CLAUDE.md` §9](../CLAUDE.md#9-backend-relayer).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health`                  | Liveness check |
| `POST` | `/analyze`                 | One-shot ChainGPT analysis of a user's position |
| `POST` | `/chat`                    | Streamed Q&A with position context (SSE) |
| `GET`  | `/alerts/:userAddress`     | SSE channel — pushes ChainGPT alerts on zone crossings |

Request bodies for `/analyze` and `/chat`:
```json
{ "userAddress": "0x...", "viewKey": "<optional>", "message": "..." }
```

`viewKey` is optional — without it, ChainGPT gets coarse context (zone + prices) but not exact amounts. With it, ChainGPT can reason about concrete repay/collateral numbers. The backend **never persists** view keys; they live in memory for 1h.

## Running locally

```bash
npm install
cp .env.example .env        # fill in CHAINGPT_API_KEY, contract addresses, RPC
npm run dev
```

## Architecture

```
[frontend] ──HTTP─▶ /analyze  ────▶ readPosition ─▶ (decrypt?) ─▶ ChainGPT
                  /chat       ────▶ same, streamed via SSE
                  /alerts/:u  ◀────[SSE]──── sessionStore ◀── eventWatcher ◀── on-chain
```

- **`services/onchain.ts`** — viem reader for position snapshots. `decryptHandle` is a placeholder that will route through the Nox Gateway once workshop details are confirmed.
- **`services/chaingpt.ts`** — thin wrapper over `@chaingpt/generalchat`, plus prompt templates and the parser that extracts the trailing `suggested_actions` JSON block.
- **`services/eventWatcher.ts`** — subscribes to `HealthFactorThresholdCrossed` and fires an analysis for any user with an active SSE subscriber (no freeloading on ChainGPT credits for silent watchers).
- **`services/sessionStore.ts`** — in-memory view keys + SSE subscribers with TTL and per-user alert throttle.

## Security notes
- View keys are redacted in logs via pino's `redact` config (`src/logger.ts`).
- ChainGPT API key is read from env only — never sent to the frontend.
- `@fastify/rate-limit` caps each IP at 60 req/min.
- On every response, the relayer accesses only the caller-provided view key (scoped per user in `sessionStore`); there is no cross-user key leakage path.

## Deployment (Railway)

- Root dir: `backend/`
- Build command: `npm run build`
- Start command: `npm run start`
- Env vars: copy from `.env.example` and fill for the target environment.

## Post-workshop TODO (Day 2)

- [ ] Replace `decryptHandle` in `services/onchain.ts` with the real Nox Gateway decrypt flow.
- [ ] Verify the `@chaingpt/generalchat` SDK constructor shape matches what ships; adjust `services/chaingpt.ts` if needed.
- [ ] If the SDK exposes true streaming, enrich `streamChainGpt` to forward raw server-sent chunks.
