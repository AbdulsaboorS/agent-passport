import type { ReactNode } from "react";

type FieldProps = {
  readonly label: string;
  readonly children: ReactNode;
};

/** One passport row: a tracked-caps label and a mono value. */
export function Field({ label, children }: FieldProps) {
  return (
    <div className="pp-row">
      <dt className="label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
