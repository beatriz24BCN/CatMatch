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

  async function loadResults(person_id?: string){
    setLoading(true); setErr(null);
    if(!person_id){ setErr('No hay perfil. Crea tu perfil primero.'); setLoading(false); return; }
    try{
      const data = await listCatsForPerson({ person_id });
      setResults(data);
    }catch(e:any){
      setErr(formatApiError(e, 'Error al obtener resultados'));
    }finally{ setLoading(false); }
  }

  useEffect(()=>{
    const person_id = (router.query.person_id as string) || (typeof window !== 'undefined' && localStorage.getItem('catmatch_person_id'));
    loadResults(person_id as string);
  },[router.query.person_id]);

  return (
    <Layout title="Tus gatos compatibles">
      <div className="container page">
        <h1>Gatos sugeridos para ti</h1>
        <p className="lead" style={{marginBottom:20}}>Ordenados de menos a más incompatibilidades detectadas. Cada gato incluye por qué encaja o no contigo.</p>
        {loading && <div className="loading" role="status" aria-live="polite"><span className="spinner" />Calculando tus resultados…</div>}
        {err && (
          <div className="alert alert-error" role="alert">
            <div>{err}</div>
            <div className="btn-row" style={{marginTop:10}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{
                const person_id = (router.query.person_id as string) || (typeof window !== 'undefined' && localStorage.getItem('catmatch_person_id'));
                loadResults(person_id as string);
              }}>Reintentar</button>
              <Link href="/adopt/profile" className="btn btn-ghost btn-sm">Crear o editar mi perfil</Link>
            </div>
          </div>
        )}
        {!loading && !err && results.length===0 && (
          <div className="empty">
            <CatSilhouette className="empty-icon" />
            <h3>Todavía no hay gatos para mostrar</h3>
            <p>No hemos encontrado gatos disponibles para tu perfil. Vuelve pronto o revisa tu perfil.</p>
            <Link href="/adopt/profile" className="btn btn-secondary">Revisar mi perfil</Link>
          </div>
        )}
        <div style={{display:'grid',gap:16}}>
          {results.map((r,i)=>(<CatCard key={r?.cat?.id || i} item={r} />))}
        </div>
      </div>
    </Layout>
  );
}
