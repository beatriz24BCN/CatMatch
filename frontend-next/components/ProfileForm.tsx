import { useState, useEffect } from 'react';
import { createPerson } from '../lib/api';
import { formatApiError } from '../lib/formatError';
import { useRouter } from 'next/router';

const DRAFT_KEY = 'catmatch_profile_draft';
const ALLOWED_ACTIVITY = ['', 'low', 'medium', 'high', 'very_high'];

export default function ProfileForm(){
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traitsText, setTraitsText] = useState('');
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
          if(Array.isArray(parsed.preferred_cat_traits)) setTraitsText(parsed.preferred_cat_traits.join(', '));
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
        setError('Selecciona un nivel de actividad válido: bajo, medio, alto o muy alto.');
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
      // The API schema requires every field to be present (nullable); send null for those the form does not collect
      const payload = {
        bio: null, home_type: null, home_size: null, has_outdoor_space: null,
        work_hours_per_day: null, other_pets_details: null, personality_traits: null,
        ...form,
        time_available: form.time_available || null,
        time_outside: form.time_outside || null,
        activity_level: form.activity_level || null,
      };
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
      setError(formatApiError(e, 'Error al crear el perfil'));
    }finally{ setLoading(false); }
  }

  return (
    <div className="card form-card">
      <h2>Paso {step} de 4</h2>
      <ol className="stepper" aria-hidden="true">
        {[1,2,3,4].map(n=>(<li key={n} className={n<=step?'done':''} />))}
      </ol>
      <div style={{marginBottom:12}}>
        {step===1 && (
          <div>
            <div className="field">
              <label htmlFor="full_name">Nombre completo</label>
              <input id="full_name" type="text" autoComplete="name" value={form.full_name} onChange={e=>update('full_name', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="location">Ubicación (obligatorio)</label>
              <input id="location" type="text" aria-required="true" autoComplete="address-level2" placeholder="Ej: Barcelona" value={form.location} onChange={e=>update('location', e.target.value)} />
            </div>
          </div>
        )}
        {step===2 && (
          <div>
            <div className="field">
              <label htmlFor="has_children">¿Tienes niños en casa?</label>
              <select id="has_children" value={form.has_children? 'yes':'no'} onChange={e=>update('has_children', e.target.value)}>
                <option value='no'>No</option>
                <option value='yes'>Sí</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="has_other_pets">¿Tienes otras mascotas?</label>
              <select id="has_other_pets" value={form.has_other_pets? 'yes':'no'} onChange={e=>update('has_other_pets', e.target.value)}>
                <option value='no'>No</option>
                <option value='yes'>Sí</option>
              </select>
            </div>
          </div>
        )}
        {step===3 && (
          <div>
            <div className="field">
              <label htmlFor="activity_level">Nivel de actividad</label>
              <select id="activity_level" value={form.activity_level} onChange={e=>update('activity_level', e.target.value)}>
                <option value=''>Selecciona un nivel</option>
                <option value='low'>Bajo</option>
                <option value='medium'>Medio</option>
                <option value='high'>Alto</option>
                <option value='very_high'>Muy alto</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="preferred_cat_traits">Rasgos que buscas en un gato (opcional)</label>
              <input id="preferred_cat_traits" type="text" value={traitsText} onChange={e=>{ setTraitsText(e.target.value); update('preferred_cat_traits', e.target.value); }} placeholder='Ej: sociable, calm, playful' />
              <span className="hint">Sepáralos con comas.</span>
            </div>
            <div className="field">
              <label htmlFor="time_available">Tiempo que puedes dedicarle (opcional)</label>
              <input id="time_available" type="text" maxLength={100} placeholder="Ej: unas horas por la tarde" value={form.time_available} onChange={e=>update('time_available', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="time_outside">Tiempo que pasas fuera de casa (opcional)</label>
              <input id="time_outside" type="text" maxLength={100} placeholder="Ej: trabajo desde casa" value={form.time_outside} onChange={e=>update('time_outside', e.target.value)} />
            </div>
          </div>
        )}
        {step===4 && (
          <div>
            <h4>Revisar</h4>

            <section aria-labelledby="review-personal" className="review-section">
              <h5 id="review-personal" style={{margin:'0 0 8px 0'}}>1. Datos personales</h5>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div><strong>Nombre completo:</strong> {form.full_name ? form.full_name : '—'}</div>
                <div><strong>Ubicación:</strong> {form.location ? form.location : '—'}</div>
              </div>
            </section>

            <section aria-labelledby="review-home" className="review-section">
              <h5 id="review-home" style={{margin:'0 0 8px 0'}}>2. Tu hogar</h5>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div><strong>¿Tienes niños?</strong> {form.has_children ? 'Sí' : 'No'}</div>
                <div><strong>¿Tienes otras mascotas?</strong> {form.has_other_pets ? 'Sí' : 'No'}</div>
              </div>
            </section>

            <section aria-labelledby="review-prefs" className="review-section">
              <h5 id="review-prefs" style={{margin:'0 0 8px 0'}}>3. Preferencias</h5>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div><strong>Nivel de actividad:</strong> {({
                  low: 'Bajo',
                  medium: 'Medio',
                  high: 'Alto',
                  very_high: 'Muy alto'
                } as any)[form.activity_level] || 'No especificado'}</div>

                <div>
                  <strong>Rasgos preferidos:</strong>{' '}
                  {Array.isArray(form.preferred_cat_traits) && form.preferred_cat_traits.length > 0 ? (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:6}}>
                      {form.preferred_cat_traits.map((t:any, idx:number)=> (
                        <span key={idx} className="chip">{String(t)}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{marginLeft:6}}>Sin preferencias específicas</span>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="review-availability" className="review-section">
              <h5 id="review-availability" style={{margin:'0 0 8px 0'}}>4. Disponibilidad</h5>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {form.time_available ? (<div><strong>Tiempo disponible:</strong> {form.time_available}</div>) : null}
                {form.time_outside ? (<div><strong>Tiempo fuera de casa:</strong> {form.time_outside}</div>) : null}
                {!form.time_available && !form.time_outside && (<div style={{color:'#666'}}>No se ha especificado disponibilidad.</div>)}
              </div>
            </section>

          </div>
        )}
      </div>

      <div className="btn-row">
        {step>1 && <button type="button" className="btn btn-secondary" onClick={handlePrev}>Atrás</button>}
        {step<4 && <button type="button" className="btn btn-primary" onClick={handleNext}>Siguiente</button>}
        {step===4 && <button type="button" className="btn btn-primary" onClick={submit} disabled={loading} aria-busy={loading}>{loading? 'Guardando...': 'Crear perfil y buscar gatos'}</button>}
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
    </div>
  );
}
