import Layout from '../../components/Layout';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdoptIndex(){
  const [hasProfile, setHasProfile] = useState(false);
  useEffect(()=>{
    try{ setHasProfile(!!localStorage.getItem('catmatch_person_id')); }catch(e){ /* storage unavailable */ }
  },[]);
  return (
    <Layout title="Encontrar gato">
      <div className="container page">
        <h1>Encontrar gato</h1>
        <p className="lead">Empieza creando tu perfil y descubre los gatos que mejor encajan con tu forma de vida.</p>
        <div className="btn-row" style={{marginTop:20}}>
          <Link href="/adopt/profile" className="btn btn-primary">Crear mi perfil</Link>
          {hasProfile && <Link href="/adopt/results" className="btn btn-secondary">Ver mis resultados</Link>}
        </div>
      </div>
    </Layout>
  );
}
