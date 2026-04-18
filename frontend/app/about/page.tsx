import Link from "next/link";
import { Logo } from "@/components/Logo";
import { GoldHairline } from "@/components/GoldHairline";

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between h-20 px-10 border-b border-border">
        <Logo size="sm" />
        <Link href="/app" className="link type-label text-accent-gold">
          LAUNCH APP
        </Link>
      </header>

      <article className="max-w-[720px] mx-auto px-10 py-24 flex flex-col gap-16">
        <div className="flex flex-col items-start gap-10">
          <GoldHairline vertical width={96} />
          <h1 className="type-display-lg text-ink-primary">
            Discretion is a lending vault for private clients.
          </h1>
        </div>

        <p className="type-body-serif text-ink-secondary drop-cap">
          Private banking taught us that wealth is best held quietly. Open DeFi
          inverted that. We restore the balance. Collateral and debt on
          Discretion are held as confidential balances (ERC-7984 through iExec
          Nox). Only the account holder can see their position. Only the
          account holder can act on it.
        </p>

        <section className="flex flex-col gap-6">
          <span className="type-label">COUNSEL</span>
          <GoldHairline width={60} />
          <p className="type-body-serif text-ink-secondary">
            Each vault is paired with <em>Counsel</em>, an AI copilot powered
            by ChainGPT. Counsel watches your position continuously, alerts on
            risk, and proposes concrete remediations you can apply with a
            single signature. Counsel never holds your keys, never acts
            without you, and speaks only to you.
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <span className="type-label">TECHNIQUE</span>
          <GoldHairline width={60} />
          <ul className="type-body text-ink-secondary flex flex-col gap-2">
            <li>— Smart contracts: Solidity, deployed on Arbitrum Sepolia</li>
            <li>— Confidentiality: ERC-7984 via iExec Nox</li>
            <li>— Oracle: Chainlink, with a documented owner override for testnet demos</li>
            <li>— Copilot: ChainGPT Web3 Chat SDK</li>
            <li>— Frontend: Next.js, wagmi, viem, Tailwind</li>
          </ul>
        </section>

        <section className="flex flex-col gap-6">
          <span className="type-label">REPOSITORY</span>
          <GoldHairline width={60} />
          <p className="type-body text-ink-secondary">
            The source is open. See the feedback log{" "}
            <Link href="/about#feedback" className="link text-accent-gold">
              here
            </Link>{" "}
            for our week at the Vibe Coding Challenge.
          </p>
        </section>
      </article>
    </main>
  );
}
