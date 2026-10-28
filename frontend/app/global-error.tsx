"use client";
// Keep the root-layout fallback independent of stylesheets and other application components.
export default function GlobalError({ retry }: { retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: "#f8fafc", color: "#0f172a", fontFamily: "Arial, sans-serif" }}>
    <main style={{ maxWidth: 480, margin: "12vh auto", padding: 24 }}>
      <div role="alert"><h1 style={{ fontSize: 28 }}>CareerPath is temporarily unavailable</h1><p style={{ lineHeight: 1.6 }}>We couldn’t display this page. Please try again.</p></div>
      <button onClick={retry} style={{ marginTop: 16, minHeight: 44, border: 0, borderRadius: 12, padding: "12px 20px", background: "#047857", color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Try again</button>
    </main>
  </body></html>;
}
