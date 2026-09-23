import type { PassportSnapshot } from "../data/snapshot";

/**
 * Label for stamps, field headers, and captions. Prefer the share's destination; otherwise a short
 * runtime name. Assistant product names only appear when the record carries them.
 */
export function destinationLabel(snapshot: PassportSnapshot): string {
  if (snapshot.share !== undefined) {
    return snapshot.share.destination;
  }

  return destinationShortName(snapshot.bundle.runtime);
}

/** Short label when no share destination is set yet. */
export function destinationShortName(runtime: PassportSnapshot["bundle"]["runtime"]): string {
  if (runtime.kind === "local") {
    return "Local";
  }

  // First word of the runtime name ("Muse Secure VM POC" → "Muse") until the snapshot carries a
  // destination label of its own.
  const [first] = runtime.name.split(/\s+/);

  return first ?? runtime.name;
}
