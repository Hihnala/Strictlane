/** Blurred radial glows behind the page top. Home: blue + brick; subpages: one blue glow. */
export function Ambient({ variant }: { variant: "home" | "left" | "right" }) {
  return <div className={`ambient ${variant}`} aria-hidden="true" />;
}
