import Head from 'next/head';
import Navbar from '../../../../components/Navbar';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCat, createAdoptionRequest } from '../../../../lib/api';

export default function RequestForm(){
  const router = useRouter();
  const { id } = router.query;
  const [cat,setCat] = useState<any>(null);
  const [loading,setLoading] = useState(false);
  const [sending,setSending] = useState(false);
  const [err,setErr] = useState<string | null>(null);
  const [email,setEmail] = useState('');
  const [message,setMessage] = useState('');

  useEffect(()=>{
    if(!id) return;
    setLoading(true);
    getCat(id as string)
      .then(c=>setCat(c))
      .catch((e:any)=> setErr(e?.body?.detail || e?.message || 'Error al cargar el gato'))
      .finally(()=>setLoading(false));
  },[id]);

  const [submitted, setSubmitted] = useState(false);

  function isValidEmail(v:string){
    // simple email validation
    return /\S+@\S+\.\S+/.test(v);
  }

  async function submit(e?: React.FormEvent){
    if(e){ e.preventDefault(); }
    if(sending) return; // guard to avoid duplicate submissions
    setErr(null);
    if(!email || !isValidEmail(email)){
      setErr('Introduce un email de contacto válido');
      return;
    }
    if(!id || Array.isArray(id)){
      setErr('Identificador de gato inválido');
      return;
    }
    setSending(true);
    try{
      await createAdoptionRequest({ cat_id: id as string, contact_email: email, message });
      // show explicit confirmation only after the API confirms success
      setSubmitted(true);
    }catch(e:any){
      setErr(e?.body?.detail || e?.message || 'Error al enviar la solicitud');
    }finally{
      setSending(false);
    }
  }

  return (
    <div>
      <Head><title>Solicitar adopción</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Solicitar adopción</h1>

        <div aria-live="polite" style={{minHeight:24}}>
          {loading && <div>Cargando...</div>}
        </div>

        {err && <div role="alert" style={{color:'red',marginTop:8}}>{err}</div>}

        {cat && !submitted && (
          <form onSubmit={submit} style={{maxWidth:720}} aria-labelledby="request-form-title">
            <h2 id="request-form-title">{cat.name}</h2>

            <p>{cat.description}</p>

            <div style={{marginTop:8}}>
              <label htmlFor="contactEmail">Email de contacto</label><br />
              <input id="contactEmail" name="contactEmail" type="email" aria-required="true" required
                value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%'}} />
            </div>

            <div style={{marginTop:8}}>
              <label htmlFor="contactMessage">Mensaje (opcional)</label><br />
              <textarea id="contactMessage" name="contactMessage" value={message} onChange={e=>setMessage(e.target.value)} style={{width:'100%',minHeight:120}} />
            </div>

            <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
              <button type="submit" disabled={sending} aria-busy={sending}>
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>

              <button type="button" onClick={()=>router.push(`/adopt/cat/${id}`)}>Volver a la ficha</button>

              <button type="button" onClick={()=>router.push('/adopt/results')}>Volver a resultados</button>
            </div>

          </form>
        )}

        {submitted && (
          <div style={{maxWidth:720}}>
            <h3>Solicitud enviada</h3>
            <p>Gracias. Tu solicitud ha sido enviada al equipo de adopciones. Te contactaremos por email si procede.</p>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>router.push('/adopt/results')}>Volver a resultados</button>
              <button onClick={()=>router.push(`/adopt/cat/${id}`)}>Volver a la ficha</button>
              <button onClick={()=>{ setSubmitted(false); setEmail(''); setMessage(''); }}>Crear otra solicitud</button>
            </div>
          </div>
        )}

        {!loading && !cat && !err && (
          <div style={{marginTop:12,color:'#666'}}>No se encontró el gato solicitado.</div>
        )}
      </main>
    </div>
  );
}
