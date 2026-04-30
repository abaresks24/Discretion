"use client";

import { useEffect, useMemo, useState } from "react";
import { type Address, getAddress, parseAbiItem } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { AsciiCard as Card } from "./primitives/AsciiCard";
import { ScreenShell } from "./app/ScreenShell";
import { useNoxHandle } from "@/hooks/useNoxHandle";
import { vaultAbi } from "@/lib/abi/vault";
import { oracleAbi } from "@/lib/abi/oracle";
import { ASSETS } from "@/lib/assets";
import { env } from "@/lib/env";
import { publicClient } from "@/lib/publicClient";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { COLLATERAL_ASSETS, DEBT_ASSET } from "@/lib/assets";
import { useAssetPrices } from "@/hooks/useAssetPrices";

const DEBT_DECIMALS = DEBT_ASSET.decimals;
const LOG_PAGE = 2000n;

/** Balance-changing events; every one of them names a user in topic 0. */
const USER_EVENTS = [
  parseAbiItem("event CollateralDeposited(address indexed user, address indexed asset)"),
  parseAbiItem("event CollateralWithdrawn(address indexed user, address indexed asset)"),
  parseAbiItem("event Borrowed(address indexed user)"),
  parseAbiItem("event Repaid(address indexed user)"),
  parseAbiItem("event LiquiditySupplied(address indexed lender)"),
  parseAbiItem("event LiquidityWithdrawn(address indexed lender)"),
];

type Row = {
  address: Address;
  /** Per-asset raw collateral keyed by symbol. */
  collatBySymbol: Record<string, bigint>;
  /** Aggregated USD value across all collateral assets (demo prices). */
  collatUsd: number;
  debtRaw: bigint;
  lenderRaw: bigint;
  error?: string;
};

export function AdminPanel() {
  const { address } = useAccount();
  const { client: nox } = useNoxHandle();
  const { pricesUsd } = useAssetPrices();

  const { data: ownerResult } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "owner",
  });
  const owner = ownerResult as Address | undefined;
  const isOwner = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  const [users, setUsers] = useState<Address[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Rate controls (owner can poke)
  const { data: rateState, refetch: refetchRates } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "borrowRateBps",
  });
  const { data: supplyRateState } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "supplyRateBps",
  });
  const { data: utilState } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "utilizationBps",
  });

  // 1. Scan events to collect unique user addresses.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      setScanError(null);
      try {
        const latest = await publicClient.getBlockNumber();
        const addrs = new Set<string>();
        for (const event of USER_EVENTS) {
          // Paged scan — LOG_PAGE blocks at a time to stay under RPC limits.
          for (let from = 0n; from <= latest; from += LOG_PAGE) {
            const to = from + LOG_PAGE > latest ? latest : from + LOG_PAGE;
            const logs = await publicClient.getLogs({
              address: env.VAULT_ADDRESS,
              event,
              fromBlock: from,
              toBlock: to,
            });
            for (const log of logs) {
              const who = (log.args as { user?: Address; lender?: Address })
                .user ??
                (log.args as { lender?: Address }).lender;
              if (who) addrs.add(getAddress(who));
            }
          }
        }
        if (!cancelled) setUsers([...addrs] as Address[]);
      } catch (err: any) {
        if (!cancelled) setScanError(err?.message ?? "scan failed");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  // 2. For each user, read handles + decrypt with the owner's ACL.
  useEffect(() => {
    if (!isOwner || !nox || users.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Row[] = [];
      for (const user of users) {
        try {
          const collatHandles = await Promise.all(
            COLLATERAL_ASSETS.map(
              (a) =>
                publicClient.readContract({
                  address: env.VAULT_ADDRESS,
                  abi: vaultAbi,
                  functionName: "getEncryptedCollateral",
                  args: [a.underlying, user],
                }) as Promise<`0x${string}`>,
            ),
          );
          const [dH, lH] = await Promise.all([
            publicClient.readContract({
              address: env.VAULT_ADDRESS,
              abi: vaultAbi,
              functionName: "getEncryptedDebt",
              args: [user],
            }) as Promise<`0x${string}`>,
            publicClient.readContract({
              address: env.VAULT_ADDRESS,
              abi: vaultAbi,
              functionName: "getEncryptedLenderShares",
              args: [user],
            }) as Promise<`0x${string}`>,
          ]);

          const collatRaws = await Promise.all(
            collatHandles.map((h) => (h ? nox.decrypt(h) : Promise.resolve(0n))),
          );
          const [d, l] = await Promise.all([
            dH ? nox.decrypt(dH) : 0n,
            lH ? nox.decrypt(lH) : 0n,
          ]);

          const collatBySymbol: Record<string, bigint> = {};
          let collatUsd = 0;
          COLLATERAL_ASSETS.forEach((a, i) => {
            collatBySymbol[a.symbol] = collatRaws[i];
            const amt = Number(collatRaws[i]) / 10 ** a.decimals;
            collatUsd += amt * (pricesUsd[a.symbol] ?? 0);
          });

          next.push({
            address: user,
            collatBySymbol,
            collatUsd,
            debtRaw: d,
            lenderRaw: l,
          });
        } catch (err: any) {
          next.push({
            address: user,
            collatBySymbol: {},
            collatUsd: 0,
            debtRaw: 0n,
            lenderRaw: 0n,
            error: err?.message ?? "decrypt failed",
          });
        }
        if (cancelled) return;
        setRows([...next]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, nox, users]);

  // 3. Derived aggregates (what the rate engine would read).
  const aggregates = useMemo(() => {
    let totalCollUsd = 0;
    let totalDebtRaw = 0n;
    let totalLpRaw = 0n;
    for (const r of rows) {
      totalCollUsd += r.collatUsd;
      totalDebtRaw += r.debtRaw;
      totalLpRaw += r.lenderRaw;
    }
    const debtHuman = Number(totalDebtRaw) / 10 ** DEBT_DECIMALS;
    const lpHuman = Number(totalLpRaw) / 10 ** DEBT_DECIMALS;
    const utilBps =
      lpHuman > 0 ? Math.round((debtHuman / lpHuman) * 10000) : 0;
    return { totalCollUsd, debtHuman, lpHuman, utilBps };
  }, [rows]);

  if (!isOwner) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center font-mono text-sm">
        <div className="max-w-md space-y-2">
          <div className="text-ink-secondary"># audit shell</div>
          <div className="text-crit phos-glow">
            [access_denied] current session is not the vault owner.
          </div>
          <div className="text-ink-tertiary">
            # only {owner ? truncateAddress(owner) : "—"} may open this
            terminal.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[2fr_1fr] gap-3 p-3">
      <Card title="audit://positions" className="h-full" bodyClassName="gap-3">
        <div className="text-[11px] text-ink-tertiary">
          # {scanning ? "scanning events…" : `${rows.length} active positions`}
          {scanError && (
            <span className="text-crit"> [error] {scanError}</span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-quiet">
          <table className="w-full font-mono text-xs tabular-nums">
            <thead className="sticky top-0 bg-bg-raised">
              <tr className="text-ink-secondary uppercase tracking-widest text-[10px]">
                <th className="text-left py-2">address</th>
                {COLLATERAL_ASSETS.map((a) => (
                  <th key={a.symbol} className="text-right py-2">
                    {a.symbol.toLowerCase()}
                  </th>
                ))}
                <th className="text-right py-2">collat usd</th>
                <th className="text-right py-2">debt usdc</th>
                <th className="text-right py-2">supplied usdc</th>
                <th className="text-right py-2">ltv%</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !scanning && (
                <tr>
                  <td
                    colSpan={5 + COLLATERAL_ASSETS.length}
                    className="py-6 text-ink-tertiary"
                  >
                    # no active positions yet
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const d = Number(r.debtRaw) / 10 ** DEBT_DECIMALS;
                const l = Number(r.lenderRaw) / 10 ** DEBT_DECIMALS;
                const ltv = r.collatUsd > 0 ? (d / r.collatUsd) * 100 : 0;
                const zoneClass =
                  ltv >= 85
                    ? "text-crit"
                    : ltv >= 75
                      ? "text-amber"
                      : "text-phos";
                return (
                  <tr
                    key={r.address}
                    className="border-t border-ink-tertiary/50"
                  >
                    <td className="py-2 text-phos">
                      {truncateAddress(r.address)}
                    </td>
                    {COLLATERAL_ASSETS.map((a) => {
                      const raw = r.collatBySymbol[a.symbol] ?? 0n;
                      const amt = Number(raw) / 10 ** a.decimals;
                      return (
                        <td key={a.symbol} className="py-2 text-right">
                          {amt > 0 ? amt.toFixed(4) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 text-right">{r.collatUsd.toFixed(2)}</td>
                    <td className="py-2 text-right">{d.toFixed(2)}</td>
                    <td className="py-2 text-right">{l.toFixed(2)}</td>
                    <td className={cn("py-2 text-right", zoneClass)}>
                      {ltv > 0 ? ltv.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto scroll-quiet">
        <RateEnginePanel
          borrowBps={Number(rateState ?? 0n)}
          supplyBps={Number(supplyRateState ?? 0n)}
          utilBps={Number(utilState ?? 0n)}
          suggestedUtilBps={aggregates.utilBps}
          refetch={refetchRates}
        />
        <DemoOracleControls />
      </div>
    </div>
  );
}

function RateEnginePanel({
  borrowBps,
  supplyBps,
  utilBps,
  suggestedUtilBps,
  refetch,
}: {
  borrowBps: number;
  supplyBps: number;
  utilBps: number;
  suggestedUtilBps: number;
  refetch: () => void;
}) {
  const [draftBorrow, setDraftBorrow] = useState<string>(
    (borrowBps / 100).toString(),
  );
  const [draftSupply, setDraftSupply] = useState<string>(
    (supplyBps / 100).toString(),
  );
  const [draftUtil, setDraftUtil] = useState<string>((utilBps / 100).toString());
  const { writeContractAsync, isPending } = useWriteContract();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraftBorrow((borrowBps / 100).toString());
    setDraftSupply((supplyBps / 100).toString());
    setDraftUtil((utilBps / 100).toString());
  }, [borrowBps, supplyBps, utilBps]);

  // Classic Aave-style kinked curve: 2% base, 4% slope up to 80% util, steep above.
  const suggested = useMemo(() => {
    const u = suggestedUtilBps;
    const base = 200;
    const kink = 8000;
    const slope1 = 400; // to kink
    const slope2 = 6000; // past kink
    let borrow: number;
    if (u <= kink) {
      borrow = base + Math.round((u * slope1) / kink);
    } else {
      borrow = base + slope1 + Math.round(((u - kink) * slope2) / (10000 - kink));
    }
    if (borrow > 5000) borrow = 5000;
    const supply = Math.round((borrow * u) / 10000);
    return { borrowBps: borrow, supplyBps: supply, utilBps: u };
  }, [suggestedUtilBps]);

  async function submit(
    bps: { borrowBps: number; supplyBps: number; utilBps: number },
  ) {
    setErr(null);
    try {
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "setRates",
        args: [BigInt(bps.borrowBps), BigInt(bps.supplyBps), BigInt(bps.utilBps)],
      });
      await refetch();
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "failed");
    }
  }

  return (
    <Card title="rate-engine" className="h-full" bodyClassName="gap-4">
      <div className="text-[11px] text-ink-tertiary">
        # kinked interest curve — set by owner, read by the vault
      </div>

      <div className="flex flex-col gap-2 font-mono text-sm">
        <KV label="on_chain_borrow_apr" value={`${(borrowBps / 100).toFixed(2)}%`} />
        <KV label="on_chain_supply_apr" value={`${(supplyBps / 100).toFixed(2)}%`} />
        <KV label="on_chain_utilization" value={`${(utilBps / 100).toFixed(1)}%`} />
        <div className="h-px bg-ink-tertiary my-1" />
        <KV
          label="observed_utilization"
          value={`${(suggestedUtilBps / 100).toFixed(1)}%`}
          accent
        />
        <KV
          label="suggested_borrow"
          value={`${(suggested.borrowBps / 100).toFixed(2)}%`}
          accent
        />
        <KV
          label="suggested_supply"
          value={`${(suggested.supplyBps / 100).toFixed(2)}%`}
          accent
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(suggested)}
          className={cn(
            "w-full h-10 border text-[11px] uppercase tracking-[0.2em]",
            "border-phos text-phos hover:bg-phos hover:text-bg",
            "phos-glow transition-colors",
            isPending && "animate-pulse",
          )}
        >
          {isPending ? "$ applying…" : "$ ./apply-suggested-rates"}
        </button>

        <details className="text-[11px] text-ink-tertiary">
          <summary className="cursor-pointer hover:text-ink-secondary">
            $ --manual-override
          </summary>
          <div className="pt-3 flex flex-col gap-2 font-mono">
            <RateInput label="borrow %" value={draftBorrow} onChange={setDraftBorrow} />
            <RateInput label="supply %" value={draftSupply} onChange={setDraftSupply} />
            <RateInput label="util %" value={draftUtil} onChange={setDraftUtil} />
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                submit({
                  borrowBps: Math.round(Number(draftBorrow) * 100),
                  supplyBps: Math.round(Number(draftSupply) * 100),
                  utilBps: Math.round(Number(draftUtil) * 100),
                })
              }
              className="h-8 border border-ink-secondary text-ink-secondary hover:border-phos hover:text-phos text-[11px] uppercase tracking-widest"
            >
              $ ./push-custom
            </button>
          </div>
        </details>

        {err && <div className="text-crit text-[11px]">[error] {err}</div>}
      </div>
    </Card>
  );
}

function KV({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink-tertiary">=</span>
      <span
        className={cn(
          "tabular-nums",
          accent ? "text-phos phos-glow" : "text-ink-secondary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-ink-tertiary focus-within:border-phos pb-1">
      <span className="text-ink-secondary text-[11px] w-20">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        className="flex-1 bg-transparent outline-none text-phos text-sm tabular-nums"
      />
    </div>
  );
}

/**
 * Demo controls for the price oracle:
 *   - Pull live market prices from CoinGecko (RLC, USDC, ETH) and push to
 *     the on-chain oracle as `setManualOverride` calls — keeps the demo
 *     anchored to reality without depending on Chainlink heartbeats.
 *   - One-click crash buttons (-25% / -50% / -75%) per asset for the
 *     "show ChainGPT alert in real time" flow.
 *   - Manual override input as a fallback.
 *
 * All writes go through the connected wallet (must be the oracle owner).
 */
function DemoOracleControls() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { pricesUsd, refetch } = useAssetPrices();
  const [market, setMarket] = useState<Record<string, number> | null>(null);
  const [marketErr, setMarketErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function fetchMarket() {
    setMarketErr(null);
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=iexec-rlc,usd-coin,ethereum&vs_currencies=usd",
      );
      const data = await res.json();
      setMarket({
        RLC: data["iexec-rlc"]?.usd ?? 0,
        USDC: data["usd-coin"]?.usd ?? 0,
        WETH: data["ethereum"]?.usd ?? 0,
      });
    } catch (e: any) {
      setMarketErr(e?.message ?? "fetch failed");
    }
  }

  useEffect(() => {
    fetchMarket();
  }, []);

  async function setOverride(symbol: string, priceUsd: number) {
    if (priceUsd <= 0) return;
    setBusy(symbol);
    setErr(null);
    try {
      const asset = ASSETS[symbol].underlying;
      const scaled = BigInt(Math.round(priceUsd * 1e8));
      await writeContractAsync({
        address: env.ORACLE_ADDRESS,
        abi: oracleAbi,
        functionName: "setManualOverride",
        args: [asset, scaled],
      });
      await refetch();
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "tx failed");
    } finally {
      setBusy(null);
    }
  }

  async function crash(symbol: string, percent: number) {
    const current = pricesUsd[symbol];
    if (!current) return;
    await setOverride(symbol, current * (1 - percent / 100));
  }

  const symbols = Object.keys(ASSETS);

  return (
    <Card title="oracle / demo crash" bodyClassName="gap-3">
      <div className="text-[11px] text-ink-tertiary">
        # market prices (CoinGecko) → setManualOverride on-chain
        {marketErr && <span className="text-crit"> [error] {marketErr}</span>}
      </div>

      <div className="flex flex-col gap-2 font-mono text-[11px]">
        {symbols.map((sym) => {
          const onchain = pricesUsd[sym] ?? 0;
          const live = market?.[sym] ?? 0;
          const draft = drafts[sym] ?? "";
          return (
            <div key={sym} className="border border-ink-tertiary px-2 py-2 space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-phos w-12">{sym}</span>
                <span className="text-ink-tertiary">on-chain</span>
                <span className="text-ink-primary tabular-nums">
                  ${onchain.toFixed(onchain < 10 ? 4 : 2)}
                </span>
                <span className="ml-auto text-ink-tertiary">market</span>
                <span className="text-phos tabular-nums">
                  ${live.toFixed(live < 10 ? 4 : 2)}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 text-[10px]">
                {[10, 25, 50, 75].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!!busy || isPending || onchain <= 0}
                    onClick={() => crash(sym, p)}
                    className="cursor-target px-2 py-0.5 border border-crit/60 text-crit hover:bg-crit/10 transition-colors disabled:opacity-30"
                  >
                    -{p}%
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!!busy || isPending || live <= 0}
                  onClick={() => setOverride(sym, live)}
                  className="cursor-target px-2 py-0.5 border border-phos/60 text-phos hover:bg-phos/10 transition-colors disabled:opacity-30"
                >
                  ▸ market
                </button>
                <input
                  value={draft}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [sym]: e.target.value.replace(/[^0-9.]/g, ""),
                    }))
                  }
                  placeholder="custom $"
                  className="ml-auto w-20 bg-transparent border-b border-ink-tertiary focus:border-phos outline-none text-right text-ink-primary"
                />
                <button
                  type="button"
                  disabled={!draft || !!busy || isPending}
                  onClick={() => setOverride(sym, Number(draft))}
                  className="cursor-target px-2 py-0.5 border border-ink-secondary text-ink-secondary hover:text-phos hover:border-phos transition-colors disabled:opacity-30"
                >
                  set
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={fetchMarket}
          className="cursor-target flex-1 h-8 border border-ink-secondary text-[11px] text-ink-secondary hover:text-phos hover:border-phos transition-colors uppercase tracking-widest"
        >
          $ ./refresh-market
        </button>
      </div>

      {err && <div className="text-crit text-[11px]">[error] {err}</div>}

      <div className="border-l-2 border-amber pl-2 py-1 bg-amber/5 text-[10px] text-ink-secondary">
        # crash {">"} iApp scan-liquidations {">"} reveal {">"} ChainGPT alert
        in copilot panel.
      </div>
    </Card>
  );
}
