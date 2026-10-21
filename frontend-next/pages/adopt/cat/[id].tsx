import Layout from '../../../components/Layout';
import { CatSilhouette } from '../../../components/icons';
import { AGE_LABELS } from '../../../lib/labels';
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
    getCat(id as string).then(c=>setCat(c)).catch(e=>setErr(formatApiError(e, 'No se ha podido cargar la ficha del gato.'))).finally(()=>setLoading(false));
  },[id]);

  const traits = (()=>{
    const pt = cat?.personality_traits;
    if(!pt) return [] as string[];
    if(Array.isArray(pt)) return pt.map(String);
    if(typeof pt === 'object') return Object.keys(pt);
    return [String(pt)];
  })();
  const photo = cat && Array.isArray(cat.image_urls) ? cat.image_urls[0] : null;

  return (
    <Layout title={cat?.name ? `${cat.name}` : 'Ficha del gato'}>
      <div className="container page">
        <p><Link href="/adopt/results" className="btn btn-ghost btn-sm">← Volver a resultados</Link></p>
        {loading && <div className="loading" role="status" aria-live="polite"><span className="spinner" />Cargando ficha…</div>}
        {err && <div className="alert alert-error" role="alert">{err}</div>}
        {cat && (
          <div className="detail-grid">
            <div className="card" style={{overflow:'hidden'}}>
              <div className="cat-photo" style={{aspectRatio:'1 / 1'}}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={cat.name ? `Foto de ${cat.name}` : 'Foto del gato'} />
                ) : <CatSilhouette />}
              </div>
              <div style={{padding:16}}>
                <Link href={`/adopt/cat/${id}/request`} className="btn btn-primary" style={{width:'100%'}}>Quiero adoptar a este gato</Link>
              </div>
            </div>
            <div>
              <h1>{cat.name}</h1>
              {cat.description && <p className="lead">{cat.description}</p>}
              <dl>
                <dt>Edad</dt><dd>{AGE_LABELS[cat.age_stage] || cat.age_stage} {cat.age_months ? `(${cat.age_months} meses)` : ''}</dd>
                <dt>Localización</dt><dd>{cat.location || '—'}</dd>
                <dt>Rasgos</dt>
                <dd>{traits.length ? <span className="chips" style={{marginTop:0}}>{traits.map(t=><span className="chip" key={t}>{t}</span>)}</span> : '—'}</dd>
              </dl>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
