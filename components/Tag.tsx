export function Tag({
  variant,
  children,
}: {
  variant?: "league" | "pending" | "noforecast";
  children: React.ReactNode;
}) {
  return <span className={`tag${variant ? ` ${variant}` : ""}`}>{children}</span>;
}
