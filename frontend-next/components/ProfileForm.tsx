import { useState, useEffect } from 'react';
import { createPerson } from '../lib/api';
import { useRouter } from 'next/router';

const DRAFT_KEY = 'catmatch_profile_draft';
const ALLOWED_ACTIVITY = ['', 'low', 'medium', 'high', 'very_high'];

export default function ProfileForm(){
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    full_name: '',
    location: '',
    activity_level: '',
    has_children: false,
    has_other_pets: false,
    preferred_cat_traits: [],
    time_available: '',
    time_outside: ''
  });

  // Load draft once on mount (do not overwrite existing state if draft missing)
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(DRAFT_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          setForm((s:any)=>({...s, ...parsed}));
        }
      }
    }catch(e){
      // ignore parse errors and keep initial state
      console.warn('Could not read draft from localStorage', e);
    }
  },[]);

  // Save draft on form changes
  function saveDraft(nextForm:any){
    try{
      localStorage.setItem(DRAFT_KEY, JSON.stringify(nextForm));
    }catch(e){
      console.warn('Could not save draft to localStorage', e);
    }
  }

  function update(k:any, v:any){
    // Normalize boolean selects
    if(k === 'has_children' || k === 'has_other_pets'){
      if(typeof v === 'string') v = v === 'yes';
      v = !!v;
    }

    // Normalize preferred_cat_traits: accept array or CSV string
    if(k === 'preferred_cat_traits'){
      let arr:any[] = [];
      if(Array.isArray(v)) arr = v;
      else if(typeof v === 'string') arr = v.split(',');
      arr = arr.map((x:any)=>String(x).trim()).filter((x:any)=>x);
      // unique
      arr = Array.from(new Set(arr));
      v = arr;
    }

    const next = {...form, [k]: v};
    setForm(next);
    saveDraft(next);
  }

  function validateStep(s:number){
    // Clear previous error
    setError(null);
    if(s === 1){
      if(!form.location || typeof form.location !== 'string' || form.location.trim() === ''){
        setError('La ubicación es obligatoria para completar el perfil.');
        return false;
      }
    }
    if(s === 3){
      // activity_level should be from allowed vocab
      if(!ALLOWED_ACTIVITY.includes(form.activity_level)){
        setError('Selecciona un nivel de actividad válido. Opciones: low, medium, high, very_high.');
        return false;
      }
    }
    return true;
  }

  function handleNext(){
    const next = step + 1;
    // validate current step before advancing
    if(!validateStep(step)) return;
    setStep(next);
  }

  function handlePrev(){
    setError(null);
    setStep((s)=>Math.max(1, s-1));
  }

  async function submit(){
    // Validate step1 and step3 before submit
    if(!validateStep(1)) return;
    if(!validateStep(3)) return;

    setLoading(true); setError(null);
    try{
      const payload = {...form};
      const created = await createPerson(payload);
      if(created && (created as any).id){
        try{ localStorage.setItem('catmatch_person_id',(created as any).id); }catch(e){ console.warn('Could not save person id', e); }
        // Only remove draft after success
        try{ localStorage.removeItem(DRAFT_KEY); }catch(e){ console.warn('Could not remove draft', e); }
        router.push(`/adopt/results?person_id=${encodeURIComponent((created as any).id)}`);
      }else{
        setError('La creación devolvió un resultado inesperado');
      }
    }catch(e:any){
      // Prefer detailed error from API body if available
      const detail = e?.body?.detail || e?.body?.message || e?.message;
      setError(detail || 'Error al crear el perfil');
    }finally{ setLoading(false); }
  }

  return (
    <div style={{maxWidth:720,margin:'0 auto',padding:16}}>
      <h2>Crear perfil (paso {step} de 4)</h2>
      <div style={{marginBottom:12}}>
        {step===1 && (
          <div>
            <label htmlFor="full_name">Nombre completo</label><br/>
            <input id="full_name" aria-label="Nombre completo" value={form.full_name} onChange={e=>update('full_name', e.target.value)} style={{width:'100%'}} />

            <label htmlFor="location">Ubicación</label><br/>
            <input id="location" aria-required="true" aria-label="Ubicación" value={form.location} onChange={e=>update('location', e.target.value)} style={{width:'100%'}} />
          </div>
        )}
        {step===2 && (
          <div>
            <label htmlFor="has_children">¿Tiene niños?</label><br/>
            <select id="has_children" value={form.has_children? 'yes':'no'} onChange={e=>update('has_children', e.target.value)} aria-label="Tiene niños">
              <option value='no'>No</option>
              <option value='yes'>Sí</option>
            </select>

            <br/>
            <label htmlFor="has_other_pets">¿Tiene otras mascotas?</label><br/>
            <select id="has_other_pets" value={form.has_other_pets? 'yes':'no'} onChange={e=>update('has_other_pets', e.target.value)} aria-label="Tiene otras mascotas">
              <option value='no'>No</option>
              <option value='yes'>Sí</option>
            </select>
          </div>
        )}
        {step===3 && (
          <div>
            <label htmlFor="activity_level">Nivel de actividad</label><br/>
            <select id="activity_level" value={form.activity_level} onChange={e=>update('activity_level', e.target.value)} style={{width:'100%'}} aria-label="Nivel de actividad">
              <option value=''>Selecciona nivel</option>
              <option value='low'>Low</option>
              <option value='medium'>Medium</option>
              <option value='high'>High</option>
              <option value='very_high'>Very high</option>
            </select>

            <label htmlFor="preferred_cat_traits">Preferencias de rasgos (coma-separados)</label><br/>
            <input id="preferred_cat_traits" value={Array.isArray(form.preferred_cat_traits)? form.preferred_cat_traits.join(', '): form.preferred_cat_traits} onChange={e=>update('preferred_cat_traits', e.target.value)} style={{width:'100%'}} placeholder='Ej: sociable, calm, playful' aria-label="Preferencias de rasgos" />
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
        {step>1 && <button onClick={handlePrev}>Atrás</button>}
        {step<4 && <button onClick={handleNext}>Siguiente</button>}
        {step===4 && <button onClick={submit} disabled={loading} aria-busy={loading}>{loading? 'Guardando...': 'Crear perfil y buscar gatos'}</button>}
      </div>
      {error && <div style={{marginTop:12,color:'red'}}>{error}</div>}
    </div>
  );
}
