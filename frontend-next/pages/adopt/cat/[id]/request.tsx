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
    setLoading(true); getCat(id as string).then(c=>setCat(c)).catch(e=>setErr(e?.message||'Error')).finally(()=>setLoading(false));
  },[id]);

  const [submitted, setSubmitted] = useState(false);

  function isValidEmail(v:string){
    // simple email validation
    return /\S+@\S+\.\S+/.test(v);
  }

  async function submit(){
    setErr(null);
    if(!email || !isValidEmail(email)){
      setErr('Introduce un email de contacto válido');
      return;
    }
    setSending(true);
    try{
      await createAdoptionRequest({ cat_id: id as string, contact_email: email, message });
      // show explicit confirmation instead of silent redirect
      setSubmitted(true);
    }catch(e:any){ setErr(e?.body?.detail || e?.message || 'Error al enviar la solicitud'); }
    setSending(false);
  }

  return (
    <div>
      <Head><title>Solicitar adopción</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Solicitar adopción</h1>
        {loading && <div>Cargando...</div>}
        {err && <div style={{color:'red'}}>{err}</div>}
        {cat && !submitted && (
          <div style={{maxWidth:720}}>
            <h2>{cat.name}</h2>
            <label>Email de contacto<br/>
              <input value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%'}} /></label>
            <label>Mensaje (opcional)<br/>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} style={{width:'100%',minHeight:120}} /></label>

            <div style={{marginTop:12}}>
              <button onClick={submit} disabled={sending}>{sending? 'Enviando...':'Enviar solicitud'}</button>
            </div>
          </div>
        )}

        {submitted && (
          <div style={{maxWidth:720}}>
            <h3>Solicitud enviada</h3>
            <p>Gracias. Tu solicitud ha sido enviada al equipo de adopciones. Te contactaremos por email si procede.</p>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>router.push('/adopt/results')}>Volver a resultados</button>
              <button onClick={()=>{ setSubmitted(false); setEmail(''); setMessage(''); }}>Crear otra solicitud</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
