// R1.5 第9便 B — 見回り (the patrol picker, PURE). 置いた問い becomes real:
// opening home may run ONE quiet generation — on the owner's device, with the
// owner's key, never on a server. This module only DECIDES whether and which;
// the caller runs it. Throttles are deliberate: at most one run per page
// open, and none within six hours of the last (cost and noise stay bounded).

export const PATROL_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type PatrolQuestion = { entryId: string; title: string; text: string };

export type PatrolDecision = { question: PatrolQuestion } | null;

/**
 * Pick the patrol target, or null when no patrol may run:
 *   - not connected → null (見回りは owner の AI が要る; honest copy elsewhere)
 *   - no placed PUBLIC question → null (nothing is waiting)
 *   - the LAST patrol (global) was under six hours ago → null
 * Among candidates: the one never patrolled first, else the longest-unpatrolled
 * (oldest per-question timestamp). Ties keep input order — never a ranking.
 */
export function pickPatrolTarget(input: {
  connected: boolean;
  questions: PatrolQuestion[];
  lastRunGlobal: string; // ISO or ""
  lastRunByQuestion: Record<string, string>; // entryId → ISO
  now: string; // ISO
}): PatrolDecision {
  if (!input.connected || input.questions.length === 0) return null;
  if (input.lastRunGlobal !== "") {
    const elapsed = Date.parse(input.now) - Date.parse(input.lastRunGlobal);
    if (!(elapsed >= PATROL_INTERVAL_MS)) return null; // NaN → fail-closed
  }
  let oldest: PatrolQuestion | null = null;
  let oldestAt = Infinity; // never-patrolled sorts first via -Infinity
  for (const q of input.questions) {
    const at = input.lastRunByQuestion[q.entryId];
    const t = at === undefined || at === "" ? -Infinity : Date.parse(at);
    if (t < oldestAt) {
      oldestAt = t;
      oldest = q;
    }
  }
  return oldest === null ? null : { question: oldest };
}
