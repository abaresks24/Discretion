"use client";

import { useState, type ReactNode } from "react";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { cn } from "@/lib/cn";

export default function LearnPage() {
  return (
    <ScreenShell
      tag="/learn"
      title="how this works."
      subtitle="cypherpunk primer · confidential defi · iexec nox · tdx"
    >
      <div className="max-w-3xl space-y-6 pb-16">
        <p className="font-mono text-[12px] leading-relaxed text-ink-secondary">
          Discretion is a confidential lending vault on Arbitrum. Your
          collateral, your debt, and your health factor are encrypted on-chain.
          Only you — and an owner-gated audit role — can read them. Below: the
          short version of every piece, and why each one matters.
        </p>

        <Lesson
          index="01"
          title="WHAT IS DISCRETION"
          blurb="The problem · what we built · why it matters."
          defaultOpen
        >
          <Para>
            In public DeFi, every balance, every loan, every liquidation trigger
            is visible to anyone with a block explorer. Whales get front-run,
            strategies get copied, large positions get hunted. <B>Discretion</B>{" "}
            is a lending vault where the amounts never leave cipher form.
          </Para>
          <Para>
            You post collateral (cRLC), borrow a debt asset (cUSDC), and the
            chain sees only opaque ciphertext handles — no amount, no LTV, no
            health factor. Only you, holding the decryption key in your wallet,
            can see your own position. An owner-gated audit ACL exists for
            compliance, disclosed upfront.
          </Para>
          <Block label="TL;DR">
            private positions · public rails · same composability
          </Block>
        </Lesson>

        <Lesson
          index="02"
          title="CONFIDENTIAL TOKENS · ERC-7984"
          blurb="Balances live as ciphertext. Arithmetic runs on encrypted values."
        >
          <Para>
            Standard ERC-20 stores <code>mapping(address =&gt; uint256)</code>{" "}
            balances — readable by anyone. ERC-7984 replaces the amount with a{" "}
            <code>bytes32</code> <B>handle</B>: a pointer to a ciphertext held
            by the FHE coprocessor.
          </Para>
          <Pre>{`// ERC-20
function balanceOf(address) returns (uint256);

// ERC-7984
function confidentialBalanceOf(address) returns (bytes32);
//                                        ^^^^^^^
//                                        opaque handle`}</Pre>
          <Para>
            The coprocessor can run <code>add</code>, <code>sub</code>,{" "}
            <code>lt</code>, <code>select</code> <B>directly on ciphertext</B>,
            under an access-control list (ACL). Only accounts granted on the
            ACL can ask the gateway to decrypt.
          </Para>
          <Block label="BLOCK EXPLORER">
            Everyone sees: <code>confidentialBalanceOf(user) =&gt; 0x0000aa…</code>
            <br />
            You see (after decrypt): <code>0.1 RLC</code>
          </Block>
        </Lesson>

        <Lesson
          index="03"
          title="iEXEC NOX · FHE GATEWAY"
          blurb="How encryption and decryption actually happen, client-side."
        >
          <Para>
            <B>Nox</B> is iExec's FHE network. Three moving parts matter:
          </Para>
          <List>
            <Item>
              <B>Coprocessor:</B> stores ciphertexts and runs FHE ops on them —
              the contract emits symbolic handles, the coprocessor keeps the
              real data.
            </Item>
            <Item>
              <B>Gateway:</B> the HTTP endpoint your browser calls to{" "}
              <code>encryptInput()</code> before submitting a tx, and to{" "}
              <code>decrypt()</code> when reading your own handles.
            </Item>
            <Item>
              <B>ACL:</B> every handle carries a list of allowed readers. Your
              own handles are authorised for your wallet via{" "}
              <code>FHE.allow(user, handle)</code> inside the contract.
            </Item>
          </List>
          <Pre>{`// client side, in useAllocate.ts
const { handle, handleProof } =
  await nox.encryptInput(raw, "uint256", wrapper);
await vault.depositCollateral(handle, handleProof);`}</Pre>
          <Block label="KEYS">
            View keys live in your wallet. We never store them server-side.
            Logout clears them.
          </Block>
        </Lesson>

        <Lesson
          index="04"
          title="THE TDX MIXER"
          blurb="Why wrapping plaintext → confidential leaks timing, and how we fix it."
        >
          <Para>
            When you convert plaintext RLC into confidential cRLC, the{" "}
            <code>wrap(user, amount)</code> call emits a public event showing{" "}
            <B>amount and recipient</B>. A chain watcher can link "this wrap =
            this later deposit". The amount is public, the destination becomes
            trivially correlated.
          </Para>
          <Para>
            To break that link, Discretion ships a <B>soft-mixer</B>: a queue
            contract + an iExec <B>iApp</B> running inside an Intel TDX
            enclave. Users call <code>queueWrap(amount, recipient)</code>;
            every N minutes, the enclave processes the batch and signs a
            single <code>processBatch</code> transaction that mints cRLC to all
            recipients at once.
          </Para>
          <Pre>{`queueWrap(user=A, 0.1) ─┐
queueWrap(user=B, 0.5) ─┤
queueWrap(user=C, 0.2) ─┤──► TDX enclave
                        │    signs processBatch(...)
queueWrap(user=D, 0.3) ─┘      │
                               ▼
                 cRLC mints: A=0.1 · B=0.5 · C=0.2 · D=0.3
                     (amounts public, pairing with deposit broken)`}</Pre>
          <Block label="TRUST">
            The operator key is sealed <B>inside</B> the enclave — even we, the
            deployer, can't extract it. Attestation is verifiable on iExec.
          </Block>
        </Lesson>

        <Lesson
          index="05"
          title="LENDING MECHANICS"
          blurb="How you borrow, what triggers liquidation, how rates behave."
        >
          <Para>
            The vault is a single-collateral, single-debt market. You post
            cRLC, you can borrow up to <B>75% LTV</B> in cUSDC. If your LTV
            crosses <B>85%</B> (liquidation threshold), any liquidator can
            repay part of your debt and seize your collateral at a <B>5%
            bonus</B>.
          </Para>
          <Pre>{`LTV            = debt_usd / collateral_usd
max-borrow LTV = 75%        ← you can't borrow past this
liq threshold  = 85%        ← crossing this = liquidatable
liq bonus      = 5%         ← incentive to the liquidator`}</Pre>
          <Para>
            Rates follow a <B>kinked utilisation curve</B>: below 80% util the
            borrow APR climbs slowly; past 80% it spikes to keep liquidity
            available. Supply APR is a fraction of borrow APR. The{" "}
            <code>HealthFactorThresholdCrossed</code> event is the only public
            signal your position emits — it does not leak amounts.
          </Para>
          <Block label="HEALTH FACTOR">
            zone 0 (green, LTV &lt; 60%) · 1 (yellow) · 2 (orange) · 3 (red,
            liquidatable)
          </Block>
        </Lesson>

        <Lesson
          index="06"
          title="GLOSSARY"
          blurb="Terms you will see across the app."
        >
          <Glossary
            items={[
              ["handle", "bytes32 pointer to a ciphertext held by the Nox coprocessor."],
              ["operator", "ERC-7984 role allowing a contract (e.g. vault) to move your cTokens on your behalf."],
              ["wrap", "convert plaintext ERC-20 → confidential ERC-7984. Public amount, private from that point on."],
              ["unwrap", "reverse of wrap — makes the amount public again on exit."],
              ["ACL", "Access Control List: list of addresses allowed to decrypt a handle via the Nox gateway."],
              ["round", "batching window in the mixer queue. The iApp processes one round per run."],
              ["attestation", "cryptographic proof that code ran inside a genuine TDX enclave with a specific measurement."],
              ["audit grant", "owner-gated ACL that lets a designated auditor decrypt all positions — opt-out for mainnet."],
              ["LTV", "loan-to-value, debt / collateral value."],
              ["health factor", "derived from LTV; crosses zones as your position drifts."],
            ]}
          />
        </Lesson>

        <AsciiCard title="NEXT STEPS" className="mt-10">
          <div className="font-mono text-[11px] text-ink-secondary space-y-2">
            <p>
              → <a href="/app/borrow" className="cursor-target text-phos hover:underline">/app/borrow</a>{" "}
              — post collateral and draw a private loan.
            </p>
            <p>
              → <a href="/app/lend" className="cursor-target text-phos hover:underline">/app/lend</a>{" "}
              — supply confidential USDC and earn yield.
            </p>
            <p>
              → <a href="/app/mix" className="cursor-target text-phos hover:underline">/app/mix</a>{" "}
              — watch the mixer queue tick in real time.
            </p>
          </div>
        </AsciiCard>
      </div>
    </ScreenShell>
  );
}

function Lesson({
  index,
  title,
  blurb,
  defaultOpen,
  children,
}: {
  index: string;
  title: string;
  blurb: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="border border-ink-tertiary bg-bg-raised">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="cursor-target w-full flex items-start gap-3 px-4 py-3 text-left group"
      >
        <span className="font-mono text-[10px] text-ink-tertiary mt-[2px] w-8 shrink-0">
          [{index}]
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-mono text-[13px] uppercase tracking-[0.18em] text-ink-primary group-hover:text-phos transition-colors">
            {title}
          </span>
          <span className="block font-mono text-[11px] text-ink-tertiary mt-0.5">
            # {blurb}
          </span>
        </span>
        <span className="font-mono text-[11px] text-phos mt-[2px] shrink-0">
          [{open ? "─" : "+"}]
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300",
          open ? "max-h-[2000px]" : "max-h-0",
        )}
      >
        <div className="px-4 pb-5 pt-1 space-y-4 border-t border-dashed border-ink-tertiary">
          {children}
        </div>
      </div>
    </section>
  );
}

function Para({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[12px] leading-relaxed text-ink-secondary">
      {children}
    </p>
  );
}

function B({ children }: { children: ReactNode }) {
  return <span className="text-ink-primary">{children}</span>;
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="font-mono text-[10.5px] leading-relaxed text-phos/90 bg-bg px-3 py-2 border border-ink-tertiary whitespace-pre overflow-x-auto scroll-quiet">
      {children}
    </pre>
  );
}

function List({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2 font-mono text-[12px] leading-relaxed text-ink-secondary">
      {children}
    </ul>
  );
}

function Item({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-phos shrink-0">▸</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] text-amber border-l-2 border-amber pl-3 py-1 bg-amber/5">
      <div className="text-[9px] uppercase tracking-[0.25em] text-amber/70 mb-1">
        {label}
      </div>
      <div className="text-ink-secondary">{children}</div>
    </div>
  );
}

function Glossary({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-[11.5px]">
      {items.map(([term, def]) => (
        <div key={term} className="contents">
          <dt className="text-phos uppercase tracking-[0.15em] sm:whitespace-nowrap">
            {term}
          </dt>
          <dd className="text-ink-secondary">{def}</dd>
        </div>
      ))}
    </dl>
  );
}
