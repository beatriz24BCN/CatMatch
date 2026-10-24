import Link from 'next/link';
import { useState } from 'react';
import type { CatsForPersonItem } from '../types/api';
import { CatSilhouette } from './icons';
import { AGE_LABELS, FACTOR_LABELS } from '../lib/labels';

function prettyName(type: string){
  return FACTOR_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function CatCard({ item }:{ item: CatsForPersonItem }){
  const cat = item.cat as any;
  const match = item.match;
  const [expanded, setExpanded] = useState(false);
  const factors = Array.isArray(match?.factors) ? match.factors : [];
  // order: negatives first, then positives, then unknown/informational
  const ordered = [
    ...factors.filter(f => f.match === false),
    ...factors.filter(f => f.match === true),
    ...factors.filter(f => f.match !== false && f.match !== true),
  ];

  const visibleCount = expanded ? ordered.length : Math.min(3, ordered.length);

  const toYesNo = (v:any)=>{
    if (v === true || String(v) === 'True' || String(v) === 'true') return 'Sí';
    if (v === false || String(v) === 'False' || String(v) === 'false') return 'No';
    return String(v);
  }

  const detailLabel = (k:string) => {
    const map: Record<string,string> = {
      person_location: 'Tu ubicación',
      cat_location: 'Ubicación del gato',
      person_has_children: 'Tienes niños',
      cat_good_with_children: 'Gato apto con niños',
      person_has_other_pets: 'Tienes otras mascotas',
      cat_good_with_dogs: 'Gato apto con otras mascotas',
      person_activity: 'Tu nivel de actividad',
      cat_activity: 'Nivel de actividad del gato',
      overlap_count: 'Coincidencias',
      overlap_items: 'Rasgos en común',
      cat_health_status: 'Estado de salud',
    };
    return map[k] || k.replace(/_/g,' ');
  }

  function renderFactorMessage(f:any){
    const details = f?.details || {};
    const t = f?.type;
    // Good with children
    if(t === 'good_with_children'){
      const personHas = details.person_has_children;
      const catOk = details.cat_good_with_children;
      if(f.match === false){
        if(personHas) return 'No recomendado: este gato no es apto con niños y has indicado que tienes niños en casa.';
        return 'No recomendado para hogares con niños.';
      }
      if(f.match === true) return 'Apto con niños.';
      return f.explanation || 'Compatibilidad con niños: información no concluyente.';
    }

    if(t === 'good_with_other_pets'){
      const personHas = details.person_has_other_pets;
      const catOk = details.cat_good_with_dogs;
      if(f.match === false){
        if(personHas) return 'No recomendado: este gato no es apto con otras mascotas y has indicado que tienes mascotas.';
        return 'No recomendado para hogares con otras mascotas.';
      }
      if(f.match === true) return 'Apto con otras mascotas.';
      return f.explanation || 'Compatibilidad con otras mascotas: información no concluyente.';
    }

    if(t === 'activity_level'){
      const p = details.person_activity;
      const c = details.cat_activity;
      if(p && c){
        if(f.match === true) return `Nivel de actividad compatible: ${String(p)}.`;
        return `Tu nivel: ${String(p)} · Gato: ${String(c)}. Pueden no encajar en estilo de vida.`;
      }
      return f.explanation || 'Nivel de actividad: información insuficiente.';
    }

    if(t === 'location'){
      const p = details.person_location;
      const c = details.cat_location;
      if(p && c){
        if(f.match === true) return `Localización igual: ${String(p)}.`;
        return `Localización distinta: tú en ${String(p)} · Gato en ${String(c)}.`;
      }
      return f.explanation || 'Localización: información insuficiente.';
    }

    if(t === 'personality_overlap'){
      const overlap = Number(details?.overlap_count || 0);
      const items = details?.overlap_items || [];
      if(overlap > 0){
        const list = Array.isArray(items) ? items.join(', ') : String(items);
        return `Coincidencias: ${list} (${overlap} rasgo${overlap>1?'s':''}).`;
      }
      return 'Sin rasgos preferidos que coincidan.';
    }

    if(t === 'health_status'){
      const hs = details?.cat_health_status || details?.health_status;
      if(hs && !/perfil ficticio/i.test(String(hs))) return `Estado de salud: ${String(hs)}`;
      return f.explanation || 'Estado de salud: información disponible.';
    }

    // default fallback
    return f.explanation || '';
  }

  const cleanDescription = (cat?.description || '').replace(/^\[Perfil de demostración\]\s*/i, '').trim();

  return (
    <article aria-label={`Ficha resumen del gato ${cat?.name || 'sin nombre'}`} className="card result-card">
      <div className="cat-photo result-cat-photo">
        {cat.image_urls && Array.isArray(cat.image_urls) && cat.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.image_urls[0]} alt={cat.name ? `Foto de ${cat.name}` : 'Foto del gato'} loading="lazy" />
        ) : <CatSilhouette />}
      </div>
      <div className="result-info">
        <div className="result-header">
          <h3 className="result-title">{cat.name || 'Sin nombre'}</h3>
          <div className="cat-meta result-meta">
            {cat.age_stage ? `${AGE_LABELS[cat.age_stage] || cat.age_stage}${cat.age_months ? ` · ${cat.age_months} meses` : ''}` : ''}
            {cat.location ? ` · 📍 ${cat.location}` : ''}
          </div>
        </div>
        {cleanDescription && <p className="result-desc">{cleanDescription}</p>}
        <div className="cat-actions result-actions">
          <Link href={`/adopt/cat/${cat.id}`} className="btn btn-secondary btn-sm" aria-label={`Ver ficha de ${cat.name || 'gato'}`}>Ver ficha</Link>
          <Link href={`/adopt/cat/${cat.id}/request`} className="btn btn-primary btn-sm" aria-label={`Solicitar adopción de ${cat.name || 'gato'}`}>Solicitar adopción</Link>
        </div>
      </div>
      <aside className="match-panel" aria-label="Compatibilidad">
        <div className="match-panel-title">Compatibilidad</div>
        <div style={{marginTop:6}}>
          <div className="match-explanation">{match?.explanation}</div>

          {ordered.length > 0 ? (
            <div>
              {ordered.slice(0, visibleCount).map((f, idx) => (
                <div key={idx} className="factor">
                  <div className="factor-head">
                    <span>{prettyName(f.type)}</span>
                    <span className={`badge ${f.match === false ? 'badge-danger' : f.match === true ? 'badge-ok' : 'badge-warn'}`}>
                      {f.match === false ? 'Incompatibilidad' : f.match === true ? 'Compatible' : 'Informativo'}
                    </span>
                  </div>
                  <p>{renderFactorMessage(f)}</p>
                  {f.details && Object.keys(f.details).length > 0 && (
                    <details style={{marginTop:6,fontSize:'.8rem',color:'var(--muted)'}}>
                      <summary style={{cursor:'pointer'}}>Detalles</summary>
                      <div style={{marginTop:6}}>
                        {Object.entries(f.details).map(([k,v]) => (
                          <div key={k}><strong>{detailLabel(k)}:</strong> {Array.isArray(v) ? v.join(', ') : (typeof v === 'boolean' ? toYesNo(v) : String(v))}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}

              {ordered.length > 3 && (
                <div style={{textAlign:'center',marginTop:8}}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
                    {expanded ? 'Mostrar menos' : `Mostrar ${ordered.length - visibleCount} más`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{fontSize:'.85rem'}}>Sin factores de compatibilidad disponibles</div>
          )}
        </div>
      </aside>
    </article>
  );
}
