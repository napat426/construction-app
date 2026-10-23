// Dedicated minimal layout for print page — no header, sidebar, or nav.
// NOTE: must NOT render <html>/<body> here; the root layout already does (nested html breaks styles).
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
