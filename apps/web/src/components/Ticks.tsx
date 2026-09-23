import type { CSSProperties } from "react";

type TicksProps = {
  /** 0..1 of the share window that has passed. */
  readonly elapsed: number;
  /** Accessible name, e.g. `5 of 24 hours elapsed`. */
  readonly label: string;
  /** Under three hours left the elapsed ticks change colour. */
  readonly expiring?: boolean;
};

export function Ticks({ elapsed, label, expiring = false }: TicksProps) {
  // SAFETY: React's CSSProperties type omits custom properties; --elapsed is read by .ticks CSS.
  const style = { "--elapsed": String(elapsed) } as CSSProperties;

  return (
    <div
      className={expiring ? "ticks expiring" : "ticks"}
      style={style}
      role="img"
      aria-label={label}
    />
  );
}
