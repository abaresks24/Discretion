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
      subtitle="confidential defi · iexec nox · live rate engine"
    >
      <div className="max-w-3xl space-y-6 pb-16">
        <p className="font-mono text-[12px] leading-relaxed text-ink-secondary">
          Discretion is a multi-collateral lending vault on Arbitrum Sepolia.
          Per-user collateral, debt, and LP shares are encrypted on-chain
          (ERC-7984 via iExec Nox). Aggregate utilization is public so anyone
          can audit the protocol's health and price the market — but no
          individual position is visible.
        </p>

        <Lesson
          index="01"
          title="WHAT IS DISCRETION"
          blurb="The problem · what we built · why it matters."
          defaultOpen
        >
          <Para>
            In public DeFi, every balance, every loan, every liquidation
            trigger is visible to anyone with a block explorer. Whales get
            front-run, strategies get copied, large positions get hunted.{" "}
            <B>Discretion</B> is a lending vault where individual amounts
            never leave cipher form.
          </Para>
          <Para>
            You post collateral in any of three confidential assets (cRLC,
            cWETH, cUSDC), borrow cUSDC, and the chain sees only opaque
            ciphertext handles for your position — no per-user amount, no
            per-user LTV. Only you, holding the decryption key in your
            wallet, can see your own state. An owner-gated audit ACL exists
            for compliance, disclosed upfront.
          </Para>
          <Block label="TL;DR">
            private positions · public market metrics · same composability
          </Block>
        </Lesson>

        <Lesson
          index="02"
          title="CONFIDENTIAL TOKENS · ERC-7984"
          blurb="Balances live as ciphertext. Arithmetic runs on encrypted values."
        >
          <Para>
            Standard ERC-20 stores <code>mapping(address =&gt; uint256)</code>{" "}
            balances — readable by anyone. ERC-7984 replaces the amount with
            a <code>bytes32</code> <B>handle</B>: a pointer to a ciphertext
            held by the FHE coprocessor.
          </Para>
          <Pre>{`// ERC-20
function balanceOf(address) returns (uint256);

// ERC-7984
function confidentialBalanceOf(address) returns (bytes32);
//                                        ^^^^^^^
//                                        opaque handle`}</Pre>
          <Para>
            The coprocessor runs <code>add</code>, <code>sub</code>,{" "}
            <code>mul</code>, <code>lt</code>, <code>select</code>{" "}
            <B>directly on ciphertext</B>, under an access-control list
            (ACL). Only accounts on the ACL can ask the gateway to decrypt.
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
              <B>Coprocessor:</B> stores ciphertexts and runs FHE ops on
              them — the contract emits symbolic handles, the coprocessor
              keeps the real data.
            </Item>
            <Item>
              <B>Gateway:</B> the HTTP endpoint your browser calls to{" "}
              <code>encryptInput()</code> before submitting a tx, and to{" "}
              <code>decrypt()</code> when reading your own handles.
            </Item>
            <Item>
              <B>ACL:</B> every handle carries a list of allowed readers.
              When the vault writes a handle to storage, it grants
              persistent ACL to (a) the user, (b) the owner (audit), (c)
              the liquidation operator, and (d) <B>itself</B> — without
              that last one, subsequent txs can't even read their own
              storage.
            </Item>
          </List>
          <Pre>{`// client side (frontend hooks/useAllocate.ts)
const { handle, handleProof } =
  await nox.encryptInput(raw, "uint256", VAULT_ADDRESS);

await vault.depositCollateral(asset, handle, handleProof);
// or
await vault.borrow(handle, handleProof, plainAmount);`}</Pre>
          <Block label="KEYS">
            View keys live in your wallet. We never store them server-side.
            Logout clears them.
          </Block>
        </Lesson>

        <Lesson
          index="04"
          title="MIXERS · ENTRY + EXIT"
          blurb="Why every wrap leaks timing, and how we batch them away."
        >
          <Para>
            When you convert plaintext RLC into confidential cRLC, the{" "}
            <code>wrap(user, amount)</code> call emits a public event
            tying <B>amount and recipient</B>. A chain watcher links "this
            wrap = this later deposit". The amount is public; the
            destination becomes trivially correlated.
          </Para>
          <Para>
            Discretion ships <B>four queues</B> that break that link:
            three entry mixers (<code>WrapQueue</code> for RLC / WETH /
            USDC) and one exit mixer (<code>UnwrapQueue</code> for cUSDC →
            USDC). Users call <code>queueWrap(amount, recipient)</code>{" "}
            (the frontend does this automatically when you supply or lock);
            a keeper polls every 30s and signs a single{" "}
            <code>processBatch</code> tx that wraps the aggregate and fans
            cTokens out to all recipients at once.
          </Para>
          <Pre>{`queueWrap(user=A, 0.1) ─┐
queueWrap(user=B, 0.5) ─┤
queueWrap(user=C, 0.2) ─┤──► keeper signs processBatch(...)
queueWrap(user=D, 0.3) ─┘                │
                                         ▼
                cTokens minted: A=0.1 · B=0.5 · C=0.2 · D=0.3
                    (amounts public, pairing with deposit broken)`}</Pre>
          <Block label="OPERATOR ROLE">
            Today: a Node.js keeper in the backend relayer signs{" "}
            <code>processBatch</code> with a fresh hot key (rotatable).
            Production: an iExec iApp (<code>discretion-mixer</code>,
            scaffolded in this repo) runs the same logic inside an Intel
            TDX enclave with a sealed key — the deployer can't extract it,
            attestation is verifiable on iExec.
          </Block>
        </Lesson>

        <Lesson
          index="05"
          title="LENDING MECHANICS"
          blurb="What you can do, what's enforced, what's at risk."
        >
          <Para>
            <B>Three collateral assets</B> (RLC, WETH, USDC), single debt
            asset (cUSDC). Each collateral has its own max-LTV. Your
            borrow capacity is the <B>weighted</B> sum across all
            collateral you've posted.
          </Para>
          <Pre>{`Per-asset max LTV
  RLC   70%
  WETH  75%
  USDC  75%

Borrow capacity (USD) = Σ collat_i × price_i × ltv_i / 100%
Headroom              = capacity − current debt`}</Pre>
          <Para>
            Liquidation threshold is <B>85% LTV</B>; liquidator bonus is{" "}
            <B>5%</B>. The vault's FHE LTV check
            (<code>_checkBorrowLtv</code>) sums weighted collateral on
            ciphertext and compares against (current debt + new borrow).
            If the check fails, the borrow is <B>silently capped to 0</B>{" "}
            on-chain — no revert leaks "user is over-LTV". The frontend
            also greys out the borrow button before you sign so you don't
            spend gas on a silent fail.
          </Para>
          <Block label="HEALTH FACTOR ZONES">
            zone 0 (green, LTV &lt; 60%) · 1 (yellow) · 2 (orange) · 3
            (red, liquidatable). Crossing a zone triggers a public event
            that emits the user + zone — never the amounts.
          </Block>
        </Lesson>

        <Lesson
          index="06"
          title="RATE ENGINE · LOG CURVE"
          blurb="Borrow APR == Supply APR. No protocol margin. Live, public."
        >
          <Para>
            Most lending protocols set rates from a kinked curve and skim a
            reserve factor between borrowers and suppliers. Discretion
            does neither: <B>borrow APR equals supply APR</B>, and the
            curve is a smooth concave log shape — steep slope near 0% to
            attract suppliers early, mild plateau through normal
            operating ranges, asymptote to 100% at exactly 100%
            utilization.
          </Para>
          <Pre>{`utilizationBps = totalDebt × 10_000 / totalSupplied   (0 if totalSupplied == 0)`}</Pre>

          <RateCurveGraph />

          <Para>
            Implemented as a <B>10-segment piecewise-linear function</B>{" "}
            in Solidity (no log/pow library needed, monotonic, continuous
            at every breakpoint). See <code>borrowRateBps()</code> in{" "}
            <code>ConfidentialLendingVault.sol</code>.
          </Para>
          <Block label="WHY EQUAL APRs">
            No protocol skim — every basis point a borrower pays goes to
            suppliers, scaled by utilization. Simpler model, better
            alignment, and one fewer tuning knob.
          </Block>
        </Lesson>

        <Lesson
          index="07"
          title="WHAT'S PUBLIC, WHAT'S PRIVATE"
          blurb="The exact privacy boundary."
        >
          <List>
            <Item>
              <B>Private:</B> per-user collateral (per asset), debt, LP
              shares, individual confidential transfer amounts.
            </Item>
            <Item>
              <B>Public:</B> aggregate <code>totalDebt</code> and{" "}
              <code>totalSupplied</code> (drives the rate curve), oracle
              prices, utilization, borrow APR, supply APR.
            </Item>
            <Item>
              <B>Public but unlinkable:</B> the fact that an address
              participated in the vault (events fire) but not the amount
              and not the timing of the underlying conversion (mixer
              breaks the link).
            </Item>
          </List>
          <Block label="TRADE-OFF">
            Aggregate totals are revealed because they're required to set
            an honest, automatic rate. Individual privacy is preserved.
            Same trade-off every transparent-chain lending protocol
            already accepts.
          </Block>
        </Lesson>

        <Lesson
          index="08"
          title="GLOSSARY"
          blurb="Terms you will see across the app."
        >
          <Glossary
            items={[
              ["handle", "bytes32 pointer to a ciphertext held by the Nox coprocessor."],
              ["operator", "ERC-7984 role allowing a contract (e.g. vault, queue) to move your cTokens on your behalf."],
              ["wrap / unwrap", "convert plaintext ERC-20 ⇆ confidential ERC-7984. Public amount at the boundary, private internally."],
              ["ACL", "Access Control List: addresses allowed to decrypt a handle via the Nox gateway."],
              ["queue / batch", "the wrap/unwrap mixers — entries collected over time, processed by the keeper in a single tx."],
              ["plain amount", "the user-supplied plaintext value passed to the vault alongside the encrypted handle, used for the public rate aggregates."],
              ["utilization", "totalDebt / totalSupplied. Public, drives the rate curve."],
              ["LTV", "loan-to-value, debt / collateral value. Per-asset cap on how much you can borrow."],
              ["health factor zone", "0 safe · 1 warning · 2 danger · 3 liquidatable. Crossings emit public events without amounts."],
              ["audit grant", "owner-gated ACL that lets a designated auditor decrypt all positions — opt-out for mainnet."],
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
              — watch the four mixer queues tick in real time.
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

/**
 * SVG plot of the borrow/supply APR curve. Anchor points mirror the
 * piecewise-linear segments inside `borrowRateBps()`. Linear axes — the
 * exponential-tail behaviour shows up visually as a sharp upward sweep
 * in the rightmost 1% of the x-axis.
 */
function RateCurveGraph() {
  // (utilization%, APR%)
  const ANCHORS: [number, number, string?][] = [
    [0, 0],
    [10, 1],
    [50, 4],
    [80, 7],
    [95, 9],
    [98, 10, "98% → 10%"],
    [99, 15],
    [99.5, 25],
    [99.9, 50],
    [99.99, 80],
    [100, 100],
  ];

  // Plot canvas
  const W = 620;
  const H = 320;
  const PL = 50; // padding left
  const PR = 28; // padding right
  const PT = 22; // padding top
  const PB = 50; // padding bottom
  const PW = W - PL - PR;
  const PH = H - PT - PB;

  const xOf = (u: number) => PL + (u / 100) * PW;
  const yOf = (apr: number) => PT + PH - (apr / 100) * PH;

  const xTicks = [0, 25, 50, 75, 95, 100];
  const yTicks = [0, 25, 50, 75, 100];

  const polylinePoints = ANCHORS.map(
    ([u, a]) => `${xOf(u).toFixed(2)},${yOf(a).toFixed(2)}`,
  ).join(" ");

  // Highlight anchor: 98% → 10%
  const highlight = ANCHORS.find((a) => a[2]);

  return (
    <div className="border border-ink-tertiary bg-bg p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
          curve
        </span>
        <span className="font-mono text-[10px] text-ink-tertiary">
          x = utilization · y = apr
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        {/* y-axis grid + labels */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={PL}
              y1={yOf(t)}
              x2={W - PR}
              y2={yOf(t)}
              stroke="currentColor"
              className="text-ink-tertiary/40"
              strokeWidth={1}
              strokeDasharray={t === 0 ? "0" : "2 4"}
            />
            <text
              x={PL - 8}
              y={yOf(t) + 3}
              textAnchor="end"
              className="fill-ink-tertiary"
              style={{ font: "10px ui-monospace, monospace" }}
            >
              {t}%
            </text>
          </g>
        ))}

        {/* x-axis labels (no grid lines — kept clean) */}
        {xTicks.map((t) => (
          <g key={`x-${t}`}>
            <line
              x1={xOf(t)}
              y1={PT + PH}
              x2={xOf(t)}
              y2={PT + PH + 4}
              stroke="currentColor"
              className="text-ink-tertiary/60"
              strokeWidth={1}
            />
            <text
              x={xOf(t)}
              y={PT + PH + 16}
              textAnchor="middle"
              className="fill-ink-tertiary"
              style={{ font: "10px ui-monospace, monospace" }}
            >
              {t}%
            </text>
          </g>
        ))}

        {/* axis labels */}
        <text
          x={PL - 30}
          y={PT - 6}
          className="fill-ink-secondary"
          style={{ font: "10px ui-monospace, monospace" }}
        >
          APR
        </text>
        <text
          x={W - PR}
          y={H - 8}
          textAnchor="end"
          className="fill-ink-secondary"
          style={{ font: "10px ui-monospace, monospace" }}
        >
          utilization
        </text>

        {/* baseline */}
        <line
          x1={PL}
          y1={PT + PH}
          x2={W - PR}
          y2={PT + PH}
          stroke="currentColor"
          className="text-ink-tertiary"
          strokeWidth={1}
        />
        <line
          x1={PL}
          y1={PT}
          x2={PL}
          y2={PT + PH}
          stroke="currentColor"
          className="text-ink-tertiary"
          strokeWidth={1}
        />

        {/* curve area fill (subtle) */}
        <polygon
          points={`${PL},${PT + PH} ${polylinePoints} ${W - PR},${PT + PH}`}
          className="fill-phos/10"
        />

        {/* curve */}
        <polyline
          points={polylinePoints}
          fill="none"
          className="stroke-phos"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* anchor dots */}
        {ANCHORS.map(([u, a]) => (
          <circle
            key={`dot-${u}`}
            cx={xOf(u)}
            cy={yOf(a)}
            r={2.5}
            className="fill-phos"
          />
        ))}

        {/* highlight anchor (98 → 10) */}
        {highlight && (
          <g>
            <circle
              cx={xOf(highlight[0])}
              cy={yOf(highlight[1])}
              r={5}
              className="fill-amber"
              stroke="currentColor"
              strokeWidth={1}
            />
            <line
              x1={xOf(highlight[0])}
              y1={yOf(highlight[1]) - 6}
              x2={xOf(highlight[0]) - 28}
              y2={yOf(highlight[1]) - 28}
              stroke="currentColor"
              className="text-amber"
              strokeWidth={1}
            />
            <text
              x={xOf(highlight[0]) - 32}
              y={yOf(highlight[1]) - 30}
              textAnchor="end"
              className="fill-amber"
              style={{ font: "10px ui-monospace, monospace" }}
            >
              {highlight[2]}
            </text>
          </g>
        )}

        {/* asymptote indicator at 100% */}
        <line
          x1={xOf(100)}
          y1={PT}
          x2={xOf(100)}
          y2={PT + PH}
          stroke="currentColor"
          className="text-amber/40"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text
          x={xOf(100) - 4}
          y={PT + 12}
          textAnchor="end"
          className="fill-amber/80"
          style={{ font: "9px ui-monospace, monospace" }}
        >
          asymptote
        </text>
      </svg>

      {/* anchor table — small, unobtrusive */}
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-1 font-mono text-[10px] text-ink-tertiary">
        {ANCHORS.map(([u, a]) => (
          <div key={`row-${u}`} className="tabular-nums">
            <span className="text-ink-secondary">{u}%</span>
            <span className="mx-1">→</span>
            <span className="text-phos">{a}%</span>
          </div>
        ))}
      </div>
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
