/** Renders build-time Markdown (marked output) — never user input. */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={className ?? "sealed-prose"} dangerouslySetInnerHTML={{ __html: html }} />;
}
