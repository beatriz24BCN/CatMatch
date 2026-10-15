import Head from 'next/head';
import Navbar from '../../../components/Navbar';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCat } from '../../../lib/api';
import Link from 'next/link';

export default function CatDetail(){
  const router = useRouter();
  const { id } = router.query;
  const [cat,setCat] = useState<any>(null);
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState<string | null>(null);

  useEffect(()=>{
    if(!id) return;
    setLoading(true); setErr(null);
    getCat(id as string).then(c=>setCat(c)).catch(e=>setErr(e?.message||'Error')).finally(()=>setLoading(false));
  },[id]);

  return (
    <div>
      <Head><title>Ficha del gato</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Ficha</h1>
        {loading && <div>Cargando...</div>}
        {err && <div style={{color:'red'}}>{err}</div>}
        {cat && (
          <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:16}}>
            <div style={{border:'1px solid #ddd',padding:12}}>
              {cat.image_urls && cat.image_urls.length>0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cat.image_urls[0]} alt={cat.name} style={{maxWidth:'100%'}} />
              ) : <div style={{height:200,background:'#f4f4f4',display:'flex',alignItems:'center',justifyContent:'center'}}>No image</div>}
              <div style={{marginTop:8}}>
                <Link href={`/adopt/cat/${id}/request`}><a style={{display:'inline-block',padding:10,background:'#28a745',color:'#fff',borderRadius:6}}>Solicitar adopción</a></Link>
              </div>
            </div>
            <div>
              <h2>{cat.name}</h2>
              <p>{cat.description}</p>
              <dl>
                <dt>Edad</dt><dd>{cat.age_stage} {cat.age_months ? `(${cat.age_months} meses)` : ''}</dd>
                <dt>Localización</dt><dd>{cat.location}</dd>
                <dt>Rasgos</dt><dd>{cat.personality_traits ? JSON.stringify(cat.personality_traits) : '—'}</dd>
              </dl>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
