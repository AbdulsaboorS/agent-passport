const HOUR = 3_600_000;

const MINUTE = 60_000;

/** ISO 8601 to the minute, UTC: `2026-09-20T19:05Z`. The passport's own notation. */
export function formatInstant(iso: string): string {
  return `${iso.slice(0, 16)}Z`;
}

export function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / HOUR;
}

/** Share of a window that has passed, clamped to [0, 1]. */
export function elapsedFraction(startIso: string, endIso: string, nowIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const now = Date.parse(nowIso);

  if (end <= start) {
    return 1;
  }

  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** `19h left`, `2h 30m left`, `12m left`, or `expired`. */
export function describeRemaining(nowIso: string, endIso: string): string {
  const remaining = Date.parse(endIso) - Date.parse(nowIso);

  if (remaining <= 0) {
    return "expired";
  }

  const hours = Math.floor(remaining / HOUR);
  const minutes = Math.floor((remaining % HOUR) / MINUTE);

  if (hours >= 3) {
    return `${hours}h left`;
  }

  if (hours >= 1) {
    return `${hours}h ${minutes}m left`;
  }

  return `${Math.max(minutes, 1)}m left`;
}

/** Whole hours elapsed of a whole-hour window, for the ticks' accessible name. */
export function describeElapsedHours(startIso: string, endIso: string, nowIso: string): string {
  const total = Math.round(hoursBetween(startIso, endIso));
  const elapsed = Math.min(total, Math.max(0, Math.floor(hoursBetween(startIso, nowIso))));

  return `${elapsed} of ${total} hours elapsed`;
}

/** Seven characters of a commit hash, or `unknown` when the capture did not record one. */
export function shortRevision(revision: string | undefined): string {
  return revision === undefined ? "unknown" : revision.slice(0, 7);
}
