import Head from 'next/head';
import PlaceholderNotice from '../components/PlaceholderNotice';

export default function Home() {
  return (
    <>
      <Head>
        <title>CatMatch — Scaffold</title>
        <meta name="description" content="Scaffold Next.js app for CatMatch (no dependencies installed)." />
      </Head>
      <main>
        <h1>CatMatch — Next.js scaffold</h1>
        <PlaceholderNotice />
        <section>
          <h2>Next steps</h2>
          <ul>
            <li>Install dependencies with <code>npm install</code> in /frontend-next</li>
            <li>Set <code>NEXT_PUBLIC_API_BASE</code> to your backend URL (e.g. http://localhost:8000)</li>
            <li>Run <code>npm run dev</code></li>
          </ul>
        </section>
      </main>
    </>
  );
}
