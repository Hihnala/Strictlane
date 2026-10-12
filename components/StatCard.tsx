/** Label top, mono figure bottom, optional sub line. */
export function StatCard({
  label,
  figure,
  sub,
  className,
}: {
  label: React.ReactNode;
  figure: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`statcard${className ? ` ${className}` : ""}`}>
      <div className="statcard-label">{label}</div>
      <div>
        <div className="statcard-fig">{figure}</div>
        {sub !== undefined && <div className="statcard-sub">{sub}</div>}
      </div>
    </div>
  );
}
