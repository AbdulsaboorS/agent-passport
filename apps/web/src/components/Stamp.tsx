type StampProps = {
  readonly children: string;
  readonly when?: string;
};

/** Square to the grid. The Destination Assistant's mark, with the time it was made. */
export function Stamp({ children, when }: StampProps) {
  return (
    <span className="stamp">
      {children}
      {when === undefined ? null : <span className="when">{when}</span>}
    </span>
  );
}
