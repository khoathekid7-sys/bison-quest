import type { HuntConfig } from "@/config/hunt";

export type PlayMode = "live" | "demo";

export type CollectedGem = {
  gemId: string;
  photoId: string;
  collectedAt: number;
  /** Was this award produced by real verification or Demo Mode simulation? */
  verification: "live" | "simulated";
};

export type Progress = {
  huntId: string;
  huntVersion: number;
  mode: PlayMode;
  startedAt: number;
  /** Ordered list; collected[i] is always hunt.gems[i]. */
  collected: CollectedGem[];
  /** Highest hint level revealed per gem (0, 1 or 2). */
  hintLevels: Record<string, number>;
  /** Gem whose discovery card has not been dismissed yet (survives refresh). */
  unseenDiscovery: string | null;
  /** Has the player dismissed the welcome and permission screens? */
  onboarded: boolean;
};

export function initialProgress(hunt: HuntConfig, mode: PlayMode, now = Date.now()): Progress {
  return {
    huntId: hunt.id,
    huntVersion: hunt.version,
    mode,
    startedAt: now,
    collected: [],
    hintLevels: {},
    unseenDiscovery: null,
    onboarded: false,
  };
}

export function currentGemIndex(p: Progress): number {
  return p.collected.length;
}

export function currentGem(p: Progress, hunt: HuntConfig) {
  return hunt.gems[currentGemIndex(p)] ?? null;
}

export function isComplete(p: Progress, hunt: HuntConfig): boolean {
  return p.collected.length >= hunt.gems.length;
}

export type GemState = "collected" | "active" | "locked";

export function gemState(p: Progress, hunt: HuntConfig, gemId: string): GemState {
  const idx = hunt.gems.findIndex((g) => g.id === gemId);
  if (idx < 0) throw new Error(`Unknown gem ${gemId}`);
  if (idx < p.collected.length) return "collected";
  if (idx === p.collected.length) return "active";
  return "locked";
}

export class AwardError extends Error {
  constructor(public code: "duplicate" | "out_of_order" | "complete" | "unknown_gem") {
    super(`Cannot award gem: ${code}`);
  }
}

/**
 * Pure award step. Throws instead of silently ignoring so callers never think
 * an award happened when it didn't. Only the current active gem can be awarded,
 * and only once.
 */
export function applyAward(
  p: Progress,
  hunt: HuntConfig,
  award: CollectedGem,
): Progress {
  const idx = hunt.gems.findIndex((g) => g.id === award.gemId);
  if (idx < 0) throw new AwardError("unknown_gem");
  if (p.collected.some((c) => c.gemId === award.gemId)) throw new AwardError("duplicate");
  if (isComplete(p, hunt)) throw new AwardError("complete");
  if (idx !== p.collected.length) throw new AwardError("out_of_order");
  return {
    ...p,
    collected: [...p.collected, award],
    unseenDiscovery: award.gemId,
  };
}

export function revealHint(p: Progress, gemId: string, level: 1 | 2): Progress {
  const current = p.hintLevels[gemId] ?? 0;
  if (level <= current) return p;
  return { ...p, hintLevels: { ...p.hintLevels, [gemId]: Math.min(2, current + 1) } };
}

/** Basic shape check for data read back from storage. */
export function isValidProgress(value: unknown, hunt: HuntConfig): value is Progress {
  if (!value || typeof value !== "object") return false;
  const v = value as Progress;
  if (v.huntId !== hunt.id || !Array.isArray(v.collected)) return false;
  // Collected gems must be a prefix of the hunt order.
  return v.collected.every((c, i) => hunt.gems[i]?.id === c.gemId);
}
