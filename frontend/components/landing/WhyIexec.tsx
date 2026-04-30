import { Divider } from "../primitives/Divider";

const BULLETS = [
  "FHE-grade secrecy via ERC-7984 confidential tokens",
  "TDX enclave operator signs mixer batches, never leaks the key",
  "Kinked interest rate curve — borrow pays, supply earns",
  "Per-user ACL + deployer audit for regulated operations",
  "No circuit setup, no trusted ceremony, no ZK prover dance",
];

export function WhyIexec() {
  return (
    <section className="px-6 md:px-12 py-24 md:py-32 border-t border-ink-tertiary">
      <div className="max-w-6xl grid md:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-phos">
            ▸ why iexec
          </div>
          <h2 className="font-mono text-3xl md:text-4xl text-ink-primary">
            Hardware-attested privacy, not cryptographic theatre.
          </h2>
          <Divider variant="thin" />
          <p className="text-ink-secondary text-sm leading-relaxed">
            ZK rollups hide transactions behind heavy circuits that take years
            to audit. iExec runs your logic inside a TDX enclave — the code
            hash is recorded on-chain, the attestation is verifiable, and the
            operator key is sealed so that not even us can extract it. Less
            ceremony, more guarantees.
          </p>
          <p className="text-ink-tertiary text-xs leading-relaxed">
            Built on ERC-7984 confidential tokens (cRLC, cUSDC) and the Nox
            compute mesh. Arbitrum Sepolia for testnet; mainnet-ready once the
            Nox gateway flips live.
          </p>
        </div>

        <ul className="space-y-3 self-center">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-3 font-mono text-sm">
              <span className="text-phos phos-glow-soft mt-0.5">▸</span>
              <span className="text-ink-primary">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
