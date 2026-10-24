import Layout from '../../../components/Layout';
import { CatSilhouette } from '../../../components/icons';
import { AGE_LABELS, ACTIVITY_LABELS } from '../../../lib/labels';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCat } from '../../../lib/api';
import Link from 'next/link';
import { formatApiError } from '../../../lib/formatError';

export default function CatDetail(){
  const router = useRouter();
  const { id } = router.query;
  const [cat,setCat] = useState<any>(null);
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState<string | null>(null);

  useEffect(()=>{
    if(!id) return;
    setLoading(true); setErr(null);
    getCat(id as string)
      .then(c=>setCat(c))
      .catch(e=>setErr(formatApiError(e, 'No se ha podido cargar la ficha del gato.')))
      .finally(()=>setLoading(false));
  },[id]);

  const traits = (()=>{
    const pt = cat?.personality_traits;
    if(!pt) return [] as string[];
    if(Array.isArray(pt)) return pt.map(String);
    if(typeof pt === 'object') return Object.keys(pt);
    return [String(pt)];
  })();
  const photo = cat && Array.isArray(cat.image_urls) ? cat.image_urls[0] : null;
  const isLuna = String(cat?.name).toLowerCase() === 'luna' || String(photo).includes('luna.jpg');

  // Limpiar etiqueta técnica de demostración
  const cleanDescription = (cat?.description || '').replace(/^\[Perfil de demostración\]\s*/i, '').trim();

  // Tratamiento del estado de salud y cuidados: evitar textos técnicos de prueba interna
  const formatHealthStatus = (hs?: string | null) => {
    if (!hs) return 'Sin condiciones médicas destacadas';
    if (/perfil ficticio/i.test(hs) || /prueba/i.test(hs)) {
      return 'Sin condiciones médicas destacadas (en evaluación por el refugio)';
    }
    return hs;
  };

  return (
    <Layout title={cat?.name ? `${cat.name}` : 'Ficha del gato'}>
      <div className="container page">
        <p><Link href="/adopt/results" className="btn btn-ghost btn-sm">← Volver a resultados</Link></p>
        {loading && <div className="loading" role="status" aria-live="polite"><span className="spinner" />Cargando ficha…</div>}
        {err && (
          <div className="alert alert-error" role="alert">
            <div>{err}</div>
            <div className="btn-row" style={{marginTop:12}}>
              <Link href="/adopt" className="btn btn-secondary btn-sm">Ver gatos en adopción</Link>
            </div>
          </div>
        )}
        {!loading && !err && !cat && (
          <div className="empty">
            <CatSilhouette className="empty-icon" />
            <h3>Gato no encontrado</h3>
            <p>El gato solicitado no existe o ya no está disponible.</p>
            <Link href="/adopt" className="btn btn-secondary">Explorar otros gatos</Link>
          </div>
        )}
        {cat && (
          <div className="detail-grid">
            <div className="card detail-photo-card">
              <div className="detail-photo">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={cat.name ? `Foto de ${cat.name}` : 'Foto del gato'}
                    className={isLuna ? 'photo-luna' : ''}
                  />
                ) : <CatSilhouette />}
              </div>
              <div style={{padding:16}}>
                <Link href={`/adopt/cat/${id}/request`} className="btn btn-primary" style={{width:'100%'}}>Quiero adoptar a este gato</Link>
              </div>
            </div>
            <div>
              <h1>{cat.name}</h1>
              {cleanDescription && <p className="lead">{cleanDescription}</p>}
              <dl>
                <dt>Edad</dt>
                <dd>{AGE_LABELS[cat.age_stage] || cat.age_stage} {cat.age_months ? `(${cat.age_months} meses)` : ''}</dd>
                <dt>Ubicación</dt>
                <dd>{cat.location || '—'}</dd>
                <dt>Nivel de actividad</dt>
                <dd>{cat.activity_level ? (ACTIVITY_LABELS[cat.activity_level] || cat.activity_level) : '—'}</dd>
                <dt>Convivencia con niños</dt>
                <dd>{cat.good_with_children === true ? 'Sí, apto con niños' : cat.good_with_children === false ? 'No apto con niños' : 'No especificado'}</dd>
                <dt>Convivencia con perros</dt>
                <dd>{cat.good_with_dogs === true ? 'Sí, sociable con perros' : cat.good_with_dogs === false ? 'No sociable con perros' : 'No especificado'}</dd>
                <dt>Salud y cuidados</dt>
                <dd>{formatHealthStatus(cat.health_status)}</dd>
                <dt>Vacunado / Esterilizado</dt>
                <dd>{[cat.vaccinated ? 'Vacunado' : null, cat.neutered ? 'Esterilizado' : null].filter(Boolean).join(' · ') || 'No especificado'}</dd>
                <dt>Rasgos de personalidad</dt>
                <dd>{traits.length ? <span className="chips" style={{marginTop:0}}>{traits.map(t=><span className="chip" key={t}>{t}</span>)}</span> : '—'}</dd>
              </dl>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
