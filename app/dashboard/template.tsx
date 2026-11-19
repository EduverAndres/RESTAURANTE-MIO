// Re-mounts on every navigation inside this area, so each page settles into
// place (`animate-page-in`, app/globals.css) instead of snapping in. CSS, not
// framer-motion: the server-rendered HTML is visible before any script runs,
// and the reduced-motion rules collapse it.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
