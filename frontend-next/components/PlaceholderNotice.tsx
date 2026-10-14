export default function PlaceholderNotice() {
  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8, margin: '16px 0' }}>
      <h3>Scaffold ready — Next steps</h3>
      <p>
        This is a minimal Next.js + TypeScript scaffold for CatMatch. Dependencies are not installed.
      </p>
      <p>
        To run locally, install dependencies in <code>/frontend-next</code> and set <code>NEXT_PUBLIC_API_BASE</code> to the backend URL
        (for example <code>http://localhost:8000</code>), then run <code>npm run dev</code>.
      </p>
      <p>
        The API adapter is a placeholder and intentionally does not wire the existing Vite client.
        Integration options are documented in <code>lib/apiAdapter.ts</code>.
      </p>
    </div>
  );
}
