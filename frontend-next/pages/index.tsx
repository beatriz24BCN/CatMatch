import Link from 'next/link';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import CatTile from '../components/CatTile';
import { CatSilhouette } from '../components/icons';
import { formatApiError } from '../lib/formatError';
import type { Cat } from '../types/api';

const STEPS = [
  { title: 'Cuéntanos cómo vives', text: 'Responde unas pocas preguntas sobre tu hogar, tu tiempo y tu forma de ser. No necesitas crear una cuenta.' },
  { title: 'Calculamos la compatibilidad', text: 'Comparamos tu estilo de vida con las necesidades y el carácter de cada gato.' },
  { title: 'Descubre tus gatos compatibles', text: 'Verás los gatos que mejor encajan contigo y una explicación clara de por qué.' },
];

export default function Home() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cats/?limit=4')
      .then(async resp => {
        if (!resp.ok) throw new Error(resp.statusText || 'Error');
        return resp.json();
      })
      .then(data => { if (!cancelled) setCats(Array.isArray(data) ? data : []); })
      .catch(e => { if (!cancelled) setError(formatApiError(e, 'No se han podido cargar los gatos.')); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Layout
      title="Encuentra un gato compatible contigo"
      description="CatMatch compara tu estilo de vida con las necesidades de cada gato para ayudarte a encontrar una adopción que encaje."
    >
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Encuentra un gato compatible contigo</h1>
            <p className="lead">
              CatMatch compara tu estilo de vida —tu hogar, tu tiempo y tu carácter— con las necesidades
              de cada gato, para que la adopción funcione bien para ambos.
            </p>
            <div className="btn-row">
              <Link href="/adopt/profile" className="btn btn-primary">Encontrar mi match</Link>
              <Link href="/#como-funciona" className="btn btn-secondary">Cómo funciona</Link>
            </div>
          </div>
          <div className="hero-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-cat.jpg"
              alt="Gato mirando con atención, listo para encontrar un hogar"
            />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="section section-alt" aria-labelledby="como-title">
        <div className="container">
          <div className="section-head">
            <h2 id="como-title">Cómo funciona</h2>
            <p className="lead">Tres pasos sencillos para encontrar el equilibrio entre el gato y la persona.</p>
          </div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li className="step" key={s.title}>
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="destacados-title">
        <div className="container">
          <div className="section-head">
            <h2 id="destacados-title">Gatos destacados</h2>
            <p className="lead">Gatos que esperan un hogar.</p>
          </div>

          {cats === null && !error && (
            <div className="loading" role="status" aria-live="polite"><span className="spinner" />Cargando gatos…</div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {cats && cats.length === 0 && (
            <div className="empty">
              <CatSilhouette className="empty-icon" />
              <h3>Aún no hay gatos disponibles</h3>
              <p>Estamos preparando los primeros perfiles. Crea tu perfil ahora y te mostraremos los gatos compatibles en cuanto estén disponibles.</p>
              <Link href="/adopt/profile" className="btn btn-primary">Crear mi perfil</Link>
            </div>
          )}
          {cats && cats.length > 0 && (
            <div className="grid-cats">
              {cats.map(c => <CatTile key={c.id} cat={c} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="container">
          <div className="cta-band">
            <h2 id="cta-title">Cada gato merece un hogar que encaje con él</h2>
            <Link href="/adopt/profile" className="btn btn-primary">Crear mi perfil</Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
