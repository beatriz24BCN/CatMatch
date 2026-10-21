import Layout from '../../../../components/Layout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getCat, createAdoptionRequest } from '../../../../lib/api';
import { formatApiError } from '../../../../lib/formatError';

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
      .catch((e:any)=> setErr(formatApiError(e, 'Error al cargar el gato')))
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
      setErr(formatApiError(e, 'Error al enviar la solicitud'));
    }finally{
      setSending(false);
    }
  }

  return (
    <Layout title="Solicitar adopción">
      <div className="page-narrow page">
        <h1>Solicitar adopción</h1>

        <div aria-live="polite" style={{minHeight:24}}>
          {loading && <div className="loading"><span className="spinner" />Cargando…</div>}
        </div>

        {err && <div role="alert" className="alert alert-error">{err}</div>}

        {cat && !submitted && (
          <form onSubmit={submit} className="card form-card" aria-labelledby="request-form-title" noValidate>
            <h2 id="request-form-title">{cat.name}</h2>

            {cat.description && <p className="muted">{cat.description}</p>}

            <div className="field">
              <label htmlFor="contactEmail">Email de contacto</label>
              <input id="contactEmail" name="contactEmail" type="email" autoComplete="email" aria-required="true" required
                value={email} onChange={e=>setEmail(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="contactMessage">Mensaje (opcional)</label>
              <textarea id="contactMessage" name="contactMessage" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Cuéntanos por qué crees que encajáis" />
            </div>

            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={sending} aria-busy={sending}>
                {sending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={()=>router.push(`/adopt/cat/${id}`)}>Volver a la ficha</button>
              <button type="button" className="btn btn-ghost" onClick={()=>router.push('/adopt/results')}>Volver a resultados</button>
            </div>

          </form>
        )}

        {submitted && (
          <div className="card form-card" role="status">
            <div className="alert alert-success"><strong>Solicitud enviada</strong></div>
            <p>Gracias. Tu solicitud ha sido enviada al equipo de adopciones. Te contactaremos por email si procede.</p>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={()=>router.push('/adopt/results')}>Volver a resultados</button>
              <button className="btn btn-secondary" onClick={()=>router.push(`/adopt/cat/${id}`)}>Volver a la ficha</button>
              <button className="btn btn-ghost" onClick={()=>{ setSubmitted(false); setEmail(''); setMessage(''); }}>Crear otra solicitud</button>
            </div>
          </div>
        )}

        {!loading && !cat && !err && (
          <div className="empty"><h3>No se encontró el gato solicitado</h3><p>Puede que ya no esté disponible.</p></div>
        )}
      </div>
    </Layout>
  );
}
