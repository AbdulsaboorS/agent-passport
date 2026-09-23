type FingerprintProps = {
  /** Hex without separators; rendered in groups of four so it can be read aloud and compared. */
  readonly value: string;
};

export function Fingerprint({ value }: FingerprintProps) {
  const groups = value.toUpperCase().match(/.{1,4}/g) ?? [];
  const spoken = groups.join(" ");

  return (
    <span className="fp" aria-label={spoken}>
      {groups.map((group, index) => (
        <span key={`${index}-${group}`} aria-hidden="true">
          {group}
        </span>
      ))}
    </span>
  );
}
