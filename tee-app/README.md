# Discretion mixer — iExec iApp (TDX)

This is the trust-minimised operator for the `WrapQueue` on Arbitrum Sepolia.
Runs inside an iExec Intel TDX enclave, holds a sealed private key, and calls
`processBatch` on a periodic trigger.

## How it fits

```
    user          WrapQueue (on-chain)            iApp (TEE)          cRLC wrapper
     │                 │                            │                     │
     ├─ queueWrap ────▶│                            │                     │
     │   (RLC in)      │                            │                     │
     │                 │                            │                     │
     │                 │  ◀── pendingIds() ─────────┤                     │
     │                 │                            │                     │
     │                 │  ◀── processBatch(ids) ────┤                     │
     │                 ├─────── wrap(self, total) ───────────────────────▶│
     │                 │                            │                     │
     │                 ├─ confidentialTransfer ────────────▶  destination │
     │                 │   (each entry, shuffled)   │                     │
```

The operator private key is **sealed inside the TDX enclave at deploy time**
via `IEXEC_APP_DEVELOPER_SECRET`. It never leaves the enclave; the only way
it can sign is through this exact Docker image (whose hash is recorded in the
iApp contract). Even the iApp author can't recover it after deploy.

## Prerequisites

- Node.js 20+
- Docker (with `linux/amd64` buildx support)
- An iExec wallet (can be imported from a private key)
- `@iexec/iapp` CLI:
  ```sh
  npm i -g @iexec/iapp
  ```

## Setup

```sh
cd tee-app
# Import a wallet for publishing the iApp. You can use a fresh throwaway key,
# but it needs a tiny bit of RLC to pay deploy gas on Arbitrum Sepolia.
iapp wallet import
```

Pin the chain (v2 dropped Bellecour):

```sh
iapp chain select arbitrum-sepolia-testnet
```

## Operator key = the WrapQueue operator on-chain

Generate a fresh throwaway key for the operator role. This key will be sealed
inside the enclave, **and you must also grant it the operator role on the
WrapQueue contract**:

```sh
# Generate a new key (from the `contracts/` dir with foundry)
cast wallet new
# → Address: 0xNEW_OPERATOR, Private key: 0x…
```

Then from `contracts/`:

```sh
source .env
cast send $WRAP_QUEUE_ADDRESS "setOperator(address)" 0xNEW_OPERATOR \
  --rpc-url $ARBITRUM_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```

Fund the operator with a tiny amount of Arbitrum Sepolia ETH so it can pay
gas for `processBatch`:

```sh
cast send 0xNEW_OPERATOR --value 0.005ether \
  --rpc-url $ARBITRUM_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```

## Test locally

```sh
iapp test --args "0x47aA8F8e3A37CAc7A94858E169a45c3BcD3E451b 20 1"
```

The three args are `<wrapQueue> [batchLimit] [minBatch]`. On first run the
CLI asks whether to attach an **app developer secret** — say YES and paste the
operator private key (the 0x… you just generated above). It's sealed into the
local Docker image for testing; it'll be sealed into the TDX enclave on deploy.

Test output lands in `./out/` — inspect `result.json` for the tx hash (if any).

## Deploy to Arbitrum Sepolia

```sh
iapp deploy --chain arbitrum-sepolia-testnet
```

The CLI records the deployed iApp contract address in `iapp.config.json`.
Copy that address — it's the *public* address of the iApp (the enclave's
computed app identity), distinct from the sealed operator key inside.

## Trigger a batch run

```sh
iapp run <IAPP_ADDRESS> --args "0x47aA8F8e3A37CAc7A94858E169a45c3BcD3E451b 20 1" --chain arbitrum-sepolia-testnet
```

Replace `<IAPP_ADDRESS>` with the one from `iapp.config.json`.

The CLI submits a task request; an iExec TDX worker picks it up, runs this
image, and the `processBatch` transaction shows up on Arbitrum Sepolia a few
seconds later.

## What this buys us vs a plain backend cron

- **Key custody**: no host machine, no AWS instance, nobody's laptop holds the
  operator key. Compromise the iApp developer's machine → nothing to steal.
- **Code attestation**: the worker proves via remote attestation that the
  exact Docker image hash burnt into the iApp contract is what ran. Swap the
  code → a new iApp with a new address and a new sealed secret.
- **Censorship resistance**: any iExec worker in the pool can run this task;
  the operator doesn't depend on a single server.

## Known limitations (documented trade-offs)

- `pendingIds` reads a public function — an observer already sees who queued
  what amount (the `Queued` event is emitted in plaintext). The TEE adds
  **timing decorrelation and destination-mapping privacy**, not amount privacy.
  For full amount privacy you'd pair this with ZK commitments (Tornado-style)
  or move the queue balances into an ERC-7984 vault themselves.

- The `processBatch` function has `onlyOperator` — swapping operator requires
  an admin call. Not a limitation of the iApp, but a note for rotations.

- The keeper trigger is manual (`iapp run`) or cron-driven. A production
  deployment would watch the `Queued` event off-chain and schedule runs
  automatically when the queue reaches a threshold.
