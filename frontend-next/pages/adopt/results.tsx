import Head from 'next/head';
import Navbar from '../../components/Navbar';
import { useEffect, useState } from 'react';
import { listCatsForPerson } from '../../lib/api';
import CatCard from '../../components/CatCard';
import { useRouter } from 'next/router';

export default function Results(){
  const router = useRouter();
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState<string | null>(null);
  const [results,setResults] = useState<any[]>([]);

  useEffect(()=>{
    async function load(){
      setLoading(true); setErr(null);
      const person_id = (router.query.person_id as string) || (typeof window !== 'undefined' && localStorage.getItem('catmatch_person_id'));
      if(!person_id){ setErr('No hay perfil. Crea tu perfil primero.'); setLoading(false); return; }
      try{
        const data = await listCatsForPerson({ person_id });
        setResults(data);
      }catch(e:any){ setErr(e?.message || 'Error al obtener resultados'); }
      setLoading(false);
    }
    load();
  },[router.query.person_id]);

  return (
    <div>
      <Head><title>Resultados — CatMatch</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Gatos sugeridos</h1>
        {loading && <div>Cargando...</div>}
        {err && <div style={{color:'red'}}>{err}</div>}
        {!loading && !err && results.length===0 && (
          <div>
            <p>No se han encontrado gatos para tu perfil.</p>
            <p><a href="/adopt/profile">Volver a editar perfil</a> o <a href="/adopt">ir a Adopta</a>.</p>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
          {results.map((r,i)=>(<CatCard key={i} item={r} />))}
        </div>
      </main>
    </div>
  );
}
