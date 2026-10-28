import Layout from '../../components/Layout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CatSilhouette } from '../../components/icons';
import { listCatsForPerson } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';
import CatCard from '../../components/CatCard';
import { useRouter } from 'next/router';

export default function Results(){
  const router = useRouter();
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState<string | null>(null);
  const [results,setResults] = useState<any[]>([]);

  async function loadResults(person_id?: string, draftPreferences?: any){
    setLoading(true); setErr(null);
    try{
      let data;
      if (person_id) {
        data = await listCatsForPerson({ person_id });
      } else if (draftPreferences && Object.keys(draftPreferences).length > 0) {
        // Visitante sin registro previo pero con preferencias recogidas por Matcher
        data = await listCatsForPerson({ person: draftPreferences });
      } else {
        // Visitante sin registro previo y sin respuestas previas: evalúa el catálogo con el perfil base
        data = await listCatsForPerson({ person: {} });
      }
      setResults(data);
    }catch(e:any){
      setErr(formatApiError(e, 'Error al obtener resultados de compatibilidad'));
    }finally{ setLoading(false); }
  }

  useEffect(()=>{
    const person_id = (router.query.person_id as string) || (typeof window !== 'undefined' && localStorage.getItem('catmatch_person_id')) || undefined;
    let draftPrefs: any = null;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('catmatch_profile_draft') : null;
      if (raw) draftPrefs = JSON.parse(raw);
    } catch {}

    loadResults(person_id, draftPrefs);
  },[router.query.person_id]);

  return (
    <Layout title="Encuentra a tu compañero ideal">
      <div className="container page">
        <h1>Encuentra a tu compañero ideal</h1>
        <p className="lead" style={{marginBottom:20}}>
          Cuéntale a Matcher cómo es tu hogar, tu estilo de vida y qué buscas en un gato. Descubre qué gatos encajan contigo y da el primer paso hacia la adopción.
        </p>
        {loading && <div className="loading" role="status" aria-live="polite"><span className="spinner" />Calculando compatibilidad con los gatos disponibles…</div>}
        {err && (
          <div className="alert alert-error" role="alert">
            <div>{err}</div>
            <div className="btn-row" style={{marginTop:10}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{
                const person_id = (router.query.person_id as string) || (typeof window !== 'undefined' && localStorage.getItem('catmatch_person_id')) || undefined;
                loadResults(person_id);
              }}>Reintentar</button>
              <Link href="/adopt" className="btn btn-ghost btn-sm">Ver todos los gatos</Link>
            </div>
          </div>
        )}
        {!loading && !err && results.length===0 && (
          <div className="empty">
            <CatSilhouette className="empty-icon" />
            <h3>Todavía no hay gatos para mostrar</h3>
            <p>No hemos encontrado gatos disponibles en este momento. Consulta el catálogo general o vuelve pronto.</p>
            <Link href="/adopt" className="btn btn-secondary">Explorar catálogo</Link>
          </div>
        )}
        <div style={{display:'grid',gap:16}}>
          {results.map((r,i)=>(<CatCard key={r?.cat?.id || i} item={r} />))}
        </div>
      </div>
    </Layout>
  );
}
