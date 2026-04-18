import type { Address } from "viem";

/**
 * In-memory session store.
 *
 * Holds per-user view keys (needed to decrypt encrypted handles for ChainGPT
 * context) and SSE subscribers. NEVER persists to disk. Entries expire after
 * a TTL so a stale view key isn't kept around forever. See CLAUDE.md §9.3.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_ALERT_INTERVAL_MS_DEFAULT = 15_000;

type Entry = {
  viewKey: string;
  expiresAt: number;
};

type AlertSubscriber = (payload: unknown) => void;

export class SessionStore {
  private viewKeys = new Map<Address, Entry>();
  private subscribers = new Map<Address, Set<AlertSubscriber>>();
  private lastAlertAt = new Map<Address, number>();

  constructor(private readonly minAlertIntervalMs: number = MIN_ALERT_INTERVAL_MS_DEFAULT) {
    // Periodic sweep.
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref?.();
  }

  setViewKey(user: Address, viewKey: string): void {
    this.viewKeys.set(user, { viewKey, expiresAt: Date.now() + TTL_MS });
  }

  getViewKey(user: Address): string | undefined {
    const e = this.viewKeys.get(user);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.viewKeys.delete(user);
      return undefined;
    }
    return e.viewKey;
  }

  clearViewKey(user: Address): void {
    this.viewKeys.delete(user);
  }

  subscribe(user: Address, fn: AlertSubscriber): () => void {
    let set = this.subscribers.get(user);
    if (!set) {
      set = new Set();
      this.subscribers.set(user, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.subscribers.delete(user);
    };
  }

  publish(user: Address, payload: unknown): boolean {
    const now = Date.now();
    const last = this.lastAlertAt.get(user) ?? 0;
    if (now - last < this.minAlertIntervalMs) return false;
    this.lastAlertAt.set(user, now);

    const subs = this.subscribers.get(user);
    if (!subs) return true;
    for (const fn of subs) {
      try {
        fn(payload);
      } catch {
        // Don't let one broken subscriber poison the others.
      }
    }
    return true;
  }

  hasSubscribers(user: Address): boolean {
    const subs = this.subscribers.get(user);
    return !!subs && subs.size > 0;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [user, entry] of this.viewKeys) {
      if (entry.expiresAt < now) this.viewKeys.delete(user);
    }
  }
}

import { config } from "../config.js";
export const sessionStore = new SessionStore(config.ALERT_MIN_INTERVAL_MS);
