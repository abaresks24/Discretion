# Feedback on iExec tools (Nox, ERC-7984, builder experience)

> Rolling notes captured throughout the Vibe Coding Challenge week (April 17–May 1, 2026).
> Real-world friction observed while shipping `Discretion`.

---

## What worked well

### Nox docs & onboarding surface
- The Nox docs entry point (https://docs.iex.ec/nox-protocol/getting-started/welcome) is reachable, well-organized.
- The confidential-DeFi wizard (`cdefi-wizard.iex.ec`) and demo (`cdefi.iex.ec`) gave a runnable starting point — much better than wading through reference docs cold.
- The NPM org is discoverable (`@iexec-nox/nox-protocol-contracts`, `@iexec-nox/nox-confidential-contracts`, `@iexec-nox/handle`) and the Solidity libs distribute via npm so Foundry remappings work cleanly without git submodules.

### `@iexec-nox/handle` SDK on the frontend
- `createViemHandleClient(walletClient)` integrates one-line with a wagmi setup. After the initial integration, `encryptInput / decrypt` are the only two calls a frontend needs.
- The hardcoded network config inside the SDK (`NETWORK_CONFIGS[421614]`) means a developer doesn't have to chase down gateway / subgraph URLs for a supported chain.

### Gas behaviour on Arbitrum Sepolia
- Once gas overrides were tuned, FHE calls land in 100k–1.5M gas which is well within Arbitrum Sepolia's tolerance. Sequencer ignores priority fee, so `maxPriorityFeePerGas: 0` is fine.

---

## Friction points encountered

### Nox gateway availability (HARD blocker, twice in 24h)
- Twice during the build, the Nox dev gateway at `https://2e1800fc...noxprotocol.dev` returned `Connection reset by peer` on TLS handshake while DNS resolution + TCP connect succeeded. Recovery time: ~1 hour each time.
- Without the gateway, every `encryptInput` / `decrypt` call fails. The whole frontend shows zeros for every encrypted balance and every write tx is blocked. There is no graceful client-side fallback because a write requires the proof.
- **Suggestion:** publish a status page. Currently teams have no way to know "is it me, is it the gateway, is it the wallet?" until they probe with `curl`.

### ACL not granted to `address(this)` in stored handles (silent on-chain footgun)
- Custom error `NotAllowed(bytes32 handle, address contract)` (selector `0xb87a12a9`) is the symptom of "the contract that wrote this handle does not have persistent ACL on it".
- Pattern that bit me: I called `c.allow(handle, user); c.allow(handle, owner);` and assumed transient ACL from `Nox.add` would carry over to subsequent txs. It does not. Without `c.allow(handle, address(this))`, the next tx that reads `_storedHandle` reverts.
- **Suggestion:** make this explicit in the docs (a single sentence: "Nox arithmetic ops grant ACL only for the current tx; persistent ACL needs an explicit `allow(handle, address(this))` from the owning contract") and ideally add a `NoxStorage` helper that wraps `set + allowSelf` together.

### Multiple `useNoxHandle` instances → race condition / brief `null`
- Each component calling `useNoxHandle()` creates its own client instance. With wagmi's `useWalletClient` returning a fresh object reference on most re-renders, the effect re-fires constantly: I observed 5–6 parallel `createViemHandleClient` calls during a single page render.
- This caused a real bug for users — clicking "borrow" while the SDK was mid-init produced a silent no-op because the hook returned `null` for that frame.
- Workarounds: stabilize the effect via `(chainId, account)` key, share a single instance across the app via a module-level promise cache, mirror the latest client into a ref so the click handler never reads a stale state snapshot.
- **Suggestion:** ship a `<NoxHandleProvider>` React context in `@iexec-nox/handle` so consumers don't have to roll their own dedupe.

### Wallet provider conflicts (MetaMask + Rabby)
- Not iExec-specific but acutely noticeable: both extensions race for `window.ethereum`. When MetaMask loses the race, `writeContract` calls hang silently because the connector dispatches to the wrong provider.
- Symptom: `[allocate] called` logs, no MetaMask popup, no error. User waits indefinitely.
- **Mitigation:** documented in our README. Users disable one extension or set Rabby as default.

### Foundry / npm hybrid layout
- `forge install foundry-rs/forge-std` requires a git repo. On a fresh clone of a non-git distribution (zip), `git init && git add -A && git commit` is needed before forge-install works. Minor but caught me on a second machine.

---

## Day-by-day highlights

### Day 1 — Setup
- Node.js + Foundry installed cleanly on macOS via Homebrew + foundryup.
- Frontend, backend, contracts directories scaffolded; `iapp init` produced the discretion-mixer iApp template.

### Day 2-3 — Vault + queues + first deploys
- `ConfidentialLendingVault` deployed multi-collat (RLC, WETH, USDC).
- `WrapQueue` (RLC) + `UnwrapQueue` (USDC) deployed. iApp keeper scaffolded but not deployed (used a Node.js keeper inside the relayer instead).

### Day 4 — End-to-end flows on testnet
- Manual setOperator on the WrapQueue to point to the mixer operator key inside the relayer.
- First successful flow: queueWrap RLC → keeper batches → cRLC arrives → setOperator vault → depositCollateral.
- Hit `NotAllowed` on borrow. Diagnosed via `cast call` with the original tx data, identified the missing `c.allow(handle, address(this))` in `_grantAudit`. Patched + redeployed vault.

### Day 5 — UX hardening
- WalletGate viewKey was getting cleared on tab navigation due to a transient `isConnected: false` from wagmi. Fixed by tracking previous identity in a ref instead of clearing on every change.
- Auto-mixer: replaced the user-visible "wrap via mixer" checkbox with always-mixer-when-wrap-needed. Added 5min polling + state messaging while the keeper batches.
- Added WrapQueue contracts for WETH and USDC so the auto-mixer covers all three collat assets.
- Wallet conflict (MetaMask + Rabby) diagnosed and worked-around.

### Day 6 — Rate engine + plaintext aggregates
- `utilizationBps` was previously an owner-set scalar. Refactored to a derived view of plaintext `totalDebt / totalSupplied`. The vault's per-user balances stay encrypted; only aggregate totals are public — same trade-off as Aave/Compound on transparent chains.
- `borrowRateBps` / `supplyRateBps` collapsed into a single piecewise-linear concave curve: steep slope from 0 to attract suppliers, plateau through the mid-range, asymptote at 100% utilization. No protocol margin (supply == borrow APR).
- Public APR / utilization moved out of the wallet-gated section so non-connected visitors can size up the protocol before clicking Connect.

---

## Wishlist for the next cohort of builders

1. **Status page for Nox dev gateway / subgraph.** Currently impossible to distinguish a gateway outage from a misconfigured client.
2. **Solidity helper for stored handles.** Most lending / DEX-like protocols want "store handle + grant persistent ACL to self" as an atomic primitive. A `Nox.allowSelf(handle)` shorthand would have saved me hours.
3. **`@iexec-nox/handle` shared context.** A `<NoxHandleProvider>` React component built into the SDK so that every `useNoxHandle()` call in the same tree returns the same client.
4. **`iapp` operator role bootstrap script.** The iApp template has `IEXEC_APP_DEVELOPER_SECRET` for sealed keys, but doesn't expose a one-liner to (a) generate a fresh operator key, (b) `setOperator` on the target queue, (c) fund the operator. I had to write this by hand for both `WrapQueue` and `UnwrapQueue` (and again when redeploying).
5. **`forge install` should work on a fresh non-git directory.** Or the Foundry template should ship with `git init` baked into the post-install hook.

---

## Aggregate stats

- Vault redeploys during the hackathon: **3** (initial → ACL fix → plaintext aggregates + log curve).
- WrapQueues deployed: **3** (RLC + 2 added during hackathon for WETH / USDC mixer parity).
- Distinct on-chain contracts owned by this build: **7** (oracle, vault, 3 wrap queues, unwrap queue, cWETH wrapper). cRLC and cUSDC are pre-existing Nox infra.
- Total testnet ETH spent on deployments + setOperator + funding: **~0.0007 ETH** at ~0.04 gwei.
- Lines of contract code: ~700.
- Lines of frontend code: ~2500.
- Lines of backend code: ~700.
