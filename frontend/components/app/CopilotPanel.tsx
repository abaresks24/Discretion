"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useCounsel } from "@/hooks/useCounsel";
import { useLiquidationReveal } from "@/hooks/useLiquidationReveal";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { formatAmount } from "@/lib/format";
import type { SuggestedAction } from "@/lib/relayer";
import { cn } from "@/lib/cn";

type RouteCtx = {
  routeKey: string;
  label: string;
  blurb: string;
  prompts: string[];
  applyTarget?: { repay?: string; addCollat?: string; withdrawCollat?: string };
};

const ROUTE_CTX: Record<string, RouteCtx> = {
  "/app": {
    routeKey: "dashboard",
    label: "DASHBOARD",
    blurb: "overview · pick a path · check market",
    prompts: [
      "what should I do first?",
      "is borrowing safe right now?",
      "explain the rates I see",
    ],
  },
  "/app/borrow": {
    routeKey: "borrow",
    label: "BORROW",
    blurb: "lock collateral · draw a private loan",
    prompts: [
      "how much can I borrow safely?",
      "what LTV should I target?",
      "what happens if RLC drops 20%?",
    ],
    applyTarget: { addCollat: "/app/borrow", repay: "/app/manage" },
  },
  "/app/manage": {
    routeKey: "manage",
    label: "MANAGE",
    blurb: "repay · adjust collateral · unwind",
    prompts: [
      "how do I get back to safe LTV?",
      "should I repay or add collateral?",
      "how much collateral can I withdraw?",
    ],
    applyTarget: {
      repay: "/app/manage",
      addCollat: "/app/manage",
      withdrawCollat: "/app/manage",
    },
  },
  "/app/lend": {
    routeKey: "lend",
    label: "LEND",
    blurb: "supply usdc · earn yield",
    prompts: [
      "is the supply rate competitive?",
      "what risk am I taking as a lender?",
      "can I withdraw any time?",
    ],
  },
  "/app/learn": {
    routeKey: "learn",
    label: "LEARN",
    blurb: "primer · 6 modules · ask anything",
    prompts: [
      "what is ERC-7984?",
      "how does the TDX mixer break linkability?",
      "explain LTV and liquidation",
    ],
  },
  "/app/mix": {
    routeKey: "mix",
    label: "MIXER",
    blurb: "tee batch · soft mix · operator sealed",
    prompts: [
      "how does the mixer protect me?",
      "when does the next batch process?",
      "what does the iApp see?",
    ],
  },
  "/app/liquidations": {
    routeKey: "liquidations",
    label: "LIQUIDATIONS",
    blurb: "public market · first-write-wins",
    prompts: [
      "how do I liquidate a position?",
      "how is the liquidation bonus computed?",
      "what does the TEE reveal exactly?",
    ],
  },
  "/app/history": {
    routeKey: "history",
    label: "HISTORY",
    blurb: "on-chain event scan",
    prompts: [
      "what does this event mean?",
      "what does the chain leak about me?",
    ],
  },
  "/app/admin": {
    routeKey: "admin",
    label: "AUDIT",
    blurb: "owner-only audit grants",
    prompts: [
      "how does the audit ACL work?",
      "what does revoking access change?",
    ],
  },
};

function fallbackCtx(pathname: string): RouteCtx {
  return {
    routeKey: pathname.replace(/^\//, ""),
    label: "COPILOT",
    blurb: "ask anything about the vault",
    prompts: ["how does this vault work?"],
  };
}

export function CopilotPanel() {
  const pathname = usePathname() ?? "/app";
  const ctx = useMemo(() => ROUTE_CTX[pathname] ?? fallbackCtx(pathname), [pathname]);
  const { address } = useAccount();
  const pos = useDecryptedPosition();
  const { messages, isStreaming, send } = useCounsel(address, null, pos.zone);
  // Auto-reveal the user's own liquidatable position when LTV crosses the
  // 85% threshold so /liquidations becomes populated and ChainGPT alerts
  // via the SSE refresh.
  useLiquidationReveal();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, messages[messages.length - 1]?.text]);

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text || isStreaming) return;
    const snapshot = {
      totalCollatUsd: pos.totalCollatUsd,
      weightedCollatUsd: pos.weightedCollatUsd,
      debtUsd: pos.debtAmount,
      ltvBps: Math.round(pos.ltvPct * 100),
      zone: pos.zone,
      perAsset: pos.collateralByAsset
        .filter((c) => c.amount > 0)
        .map((c) => ({
          symbol: c.asset.symbol,
          amount: c.amount,
          valueUsd: c.valueUsd,
          ltvBps: c.asset.ltvBps,
        })),
    };
    void send(text, snapshot);
    setInput("");
  };

  return (
    <aside className="hidden xl:flex w-[340px] shrink-0 border-l border-ink-tertiary bg-bg flex-col">
      <header className="px-4 py-3 border-b border-ink-tertiary">
        <div className="flex items-baseline gap-2 font-mono text-[11px]">
          <span className="text-ink-tertiary">┌─[</span>
          <span className="text-phos phos-glow tracking-[0.18em]">
            COPILOT · {ctx.label}
          </span>
          <span className="text-ink-tertiary">]</span>
          <span className="flex-1 border-t border-dashed border-ink-tertiary/60 -translate-y-[3px]" />
          <span className="text-ink-tertiary">─┐</span>
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-ink-tertiary">
          # {ctx.blurb}
        </div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-ink-tertiary">
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              isStreaming ? "bg-phos animate-pulse-dot" : "bg-phos/40",
            )}
          />
          <span>
            chaingpt · {isStreaming ? "thinking" : "ready"}
          </span>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-quiet px-4 py-3 font-mono text-[12px] leading-relaxed"
      >
        {messages.length === 0 ? (
          <Greeting ctx={ctx} hasPosition={pos.collateralAmount > 0 || pos.debtAmount > 0} />
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id}>
                {m.role === "user" ? (
                  <UserBubble text={stripCtx(m.text)} at={m.at} />
                ) : (
                  <CounselBubble text={m.text} at={m.at} actions={m.actions} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-3 grid gap-1.5">
          {ctx.prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => submit(p)}
              className="cursor-target text-left font-mono text-[11px] text-ink-secondary border border-dashed border-ink-tertiary px-3 py-1.5 hover:text-phos hover:border-phos-dim transition-colors"
            >
              <span className="text-phos/60 mr-1">?</span>
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t border-ink-tertiary px-3 py-2 flex items-center gap-2 font-mono"
      >
        <span className="text-phos">&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ask anything…"
          disabled={isStreaming || !address}
          className="flex-1 bg-transparent outline-none text-[12px] text-ink-primary placeholder:text-ink-tertiary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim() || !address}
          className="cursor-target text-[10px] uppercase tracking-[0.18em] text-phos border border-phos px-2 py-1 hover:bg-phos/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          send
        </button>
      </form>
    </aside>
  );
}

function Greeting({
  ctx,
  hasPosition,
}: {
  ctx: RouteCtx;
  hasPosition: boolean;
}) {
  return (
    <div className="space-y-2 text-ink-secondary">
      <p>
        <span className="text-phos">counsel&gt;</span> connected. you are on{" "}
        <span className="text-ink-primary">/{ctx.routeKey}</span>.
      </p>
      <p className="text-ink-tertiary text-[11px]">
        {hasPosition
          ? "i can see your position state. ask me anything contextual to this page — i'll give a numerical answer when i can."
          : "no position detected yet. you can still ask conceptual questions, or pick a quick prompt below."}
      </p>
    </div>
  );
}

function UserBubble({ text, at }: { text: string; at: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] text-ink-tertiary">
        <span>[{at}]</span> <span className="text-amber">you&gt;</span>
      </div>
      <div className="pl-4 text-ink-primary whitespace-pre-wrap">{text}</div>
    </div>
  );
}

function CounselBubble({
  text,
  at,
  actions,
}: {
  text: string;
  at: string;
  actions?: SuggestedAction[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-ink-tertiary">
        <span>[{at}]</span> <span className="text-phos">counsel&gt;</span>
      </div>
      <div className="pl-4 text-ink-secondary whitespace-pre-wrap">
        {stripJsonBlock(text) || (
          <span className="animate-blink-hard text-phos">█</span>
        )}
      </div>
      {actions && actions.length > 0 && (
        <ul className="pl-4 mt-1 flex flex-col gap-1">
          {actions.map((a, i) => (
            <li key={i}>
              <ActionLink action={a} index={i + 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionLink({ action, index }: { action: SuggestedAction; index: number }) {
  const ltvPct = action.expected_new_ltv_bps / 100;
  let cmd = "";
  let amount = "";
  let unit = "";
  let href = "/app/manage";
  if (action.type === "repay") {
    cmd = "repay";
    amount = action.amount_debt;
    unit = "USDC";
    href = "/app/manage";
  } else if (action.type === "add_collateral") {
    cmd = "add-collateral";
    amount = action.amount_collateral;
    unit = "RLC";
    href = "/app/borrow";
  } else {
    cmd = "withdraw-collateral";
    amount = action.amount_collateral;
    unit = "RLC";
    href = "/app/manage";
  }
  return (
    <Link
      href={href}
      className="cursor-target group block border border-ink-tertiary px-2 py-1.5 text-[11px] hover:border-phos hover:bg-phos/5 transition-colors"
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-ink-tertiary">[{index}]</span>
        <span className="text-phos">$ ./{cmd}</span>
        <span className="text-ink-tertiary">--amount</span>
        <span className="text-ink-primary tabular-nums">
          {formatAmount(Number(amount), cmd === "repay" ? 2 : 4)}
        </span>
        <span className="text-ink-tertiary uppercase">{unit}</span>
        <span className="ml-auto text-[10px] text-ink-tertiary group-hover:text-phos">
          go ↗
        </span>
      </div>
      <div className="text-[10px] text-ink-tertiary pl-4 mt-0.5">
        # ltv after = {formatAmount(ltvPct, 2)}%
      </div>
    </Link>
  );
}

function stripCtx(text: string) {
  // The pageContext line we prepended for ChainGPT is noise to the user.
  return text.replace(/^\[user is on .*?\]\n+/s, "");
}

function stripJsonBlock(text: string) {
  // ChainGPT's structured suggestions are rendered as cards; remove the raw JSON tail.
  return text
    .replace(/```json[\s\S]*?```\s*$/g, "")
    .replace(/\{\s*"suggested_actions"[\s\S]*\}\s*$/g, "")
    .trim();
}
