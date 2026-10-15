import { useState } from 'react';
import { createPerson } from '../lib/api';
import { useRouter } from 'next/router';

export default function ProfileForm(){
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    full_name: '', location: '', activity_level: '', has_children: false, has_other_pets: false, preferred_cat_traits: [], time_available: '', time_outside: ''
  });

  function update(k:any, v:any){ setForm((s:any)=>({...s,[k]:v})); }

  async function submit(){
    // minimal validation: location is recommended by the functional spec as key info
    if(!form.location || typeof form.location !== 'string' || form.location.trim() === ''){
      setError('La ubicación es obligatoria para completar el perfil.');
      return;
    }
    setLoading(true); setError(null);
    try{
      const created = await createPerson(form);
      // store id for the flow
      if(created && (created as any).id){
        try{ localStorage.setItem('catmatch_person_id',(created as any).id); }catch(e){}
        router.push(`/adopt/results?person_id=${encodeURIComponent((created as any).id)}`);
      }else{
        setError('La creación devolvió un resultado inesperado');
      }
    }catch(e:any){
      setError(e?.message || 'Error al crear el perfil');
    }finally{ setLoading(false); }
  }

  return (
    <div style={{maxWidth:720,margin:'0 auto',padding:16}}>
      <h2>Crear perfil (paso {step} de 4)</h2>
      <div style={{marginBottom:12}}>
        {step===1 && (
          <div>
            <label>Nombre completo<br/>
            <input value={form.full_name} onChange={e=>update('full_name', e.target.value)} style={{width:'100%'}} /></label>
            <label>Ubicación<br/>
            <input value={form.location} onChange={e=>update('location', e.target.value)} style={{width:'100%'}} /></label>
          </div>
        )}
        {step===2 && (
          <div>
            <label>¿Tiene niños?<br/>
            <select value={form.has_children? 'yes':'no'} onChange={e=>update('has_children', e.target.value==='yes')}> 
              <option value='no'>No</option>
              <option value='yes'>Sí</option>
            </select></label>
            <label>¿Tiene otras mascotas?<br/>
            <select value={form.has_other_pets? 'yes':'no'} onChange={e=>update('has_other_pets', e.target.value==='yes')}> 
              <option value='no'>No</option>
              <option value='yes'>Sí</option>
            </select></label>
          </div>
        )}
        {step===3 && (
          <div>
            <label>Nivel de actividad<br/>
            <input value={form.activity_level} onChange={e=>update('activity_level', e.target.value)} style={{width:'100%'}} placeholder='low, medium, high' /></label>
            <label>Preferencias de rasgos (coma-separados)<br/>
            <input value={Array.isArray(form.preferred_cat_traits)? form.preferred_cat_traits.join(', '): form.preferred_cat_traits} onChange={e=>update('preferred_cat_traits', e.target.value.split(',').map((s:any)=>s.trim()).filter(Boolean))} style={{width:'100%'}} /></label>
          </div>
        )}
        {step===4 && (
          <div>
            <h4>Revisar</h4>
            <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(form,null,2)}</pre>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:8}}>
        {step>1 && <button onClick={()=>setStep(step-1)}>Atrás</button>}
        {step<4 && <button onClick={()=>setStep(step+1)}>Siguiente</button>}
        {step===4 && <button onClick={submit} disabled={loading}>{loading? 'Guardando...': 'Crear perfil y buscar gatos'}</button>}
      </div>
      {error && <div style={{marginTop:12,color:'red'}}>{error}</div>}
    </div>
  );
}
