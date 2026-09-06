/** Decorative page wash, built from utilities so there is no bespoke CSS to keep in step. */
export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-void to-ink"
    >
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-amber/10 blur-3xl" />
      <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-copper/10 blur-3xl" />
    </div>
  )
}
