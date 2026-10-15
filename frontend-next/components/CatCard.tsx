import Link from 'next/link';
import { useState } from 'react';
import type { CatsForPersonItem } from '../types/api';

function prettyName(type: string){
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  return (
    <article style={{border:'1px solid #ddd',padding:12,borderRadius:6,display:'flex',gap:12}}>
      <div style={{width:140,height:100,background:'#f4f4f4',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {cat.image_urls && Array.isArray(cat.image_urls) && cat.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cat.image_urls[0]} alt={cat.name || 'cat'} style={{maxWidth:'100%',maxHeight:'100%'}} />
        ) : <span>No Image</span>}
      </div>
      <div style={{flex:1}}>
        <h3 style={{margin:'0 0 8px 0'}}>{cat.name || 'Sin nombre'}</h3>
        <p style={{margin:'0 0 8px 0',color:'#333'}}>{cat.description || ''}</p>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href={`/adopt/cat/${cat.id}`} style={{padding:'6px 10px',background:'#0070f3',color:'#fff',borderRadius:4}}>Ver ficha</Link>
          <Link href={`/adopt/cat/${cat.id}/request`} style={{padding:'6px 10px',background:'#28a745',color:'#fff',borderRadius:4}}>Solicitar adopción</Link>
        </div>
      </div>
      <aside style={{width:320}}>
        <strong>Match</strong>
        <div style={{fontSize:13,marginTop:6}}>
          <div style={{marginBottom:8,color:'#222',lineHeight:1.3}}>{match?.explanation}</div>

          {ordered.length > 0 ? (
            <div>
              {ordered.slice(0, visibleCount).map((f, idx) => (
                <div key={idx} style={{marginBottom:8,padding:8,background:'#fafafa',borderRadius:6,border:'1px solid #eee'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontWeight:700}}>{prettyName(f.type)}</div>
                    <div style={{fontSize:12,color: f.match === false ? '#a00' : f.match === true ? '#0a0' : '#666'}}>
                      {f.match === false ? 'Incompatibilidad' : f.match === true ? 'Compatible' : 'Informativo'}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:'#333',marginTop:6}}>{f.explanation}</div>
                  {f.details && Object.keys(f.details).length > 0 && (
                    <details style={{marginTop:6,fontSize:11,color:'#555'}}>
                      <summary style={{cursor:'pointer'}}>Detalles</summary>
                      <div style={{marginTop:6}}>
                        {Object.entries(f.details).map(([k,v]) => (
                          <div key={k}><strong style={{textTransform:'none'}}>{k}:</strong> {String(v)}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}

              {ordered.length > 3 && (
                <div style={{textAlign:'center',marginTop:6}}>
                  <button onClick={() => setExpanded(!expanded)} style={{background:'none',border:'none',color:'#0070f3',cursor:'pointer'}}>
                    {expanded ? 'Mostrar menos' : `Mostrar ${ordered.length - visibleCount} más`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{fontSize:12,color:'#666'}}>Sin factores de compatibilidad disponibles</div>
          )}
        </div>
      </aside>
    </article>
  );
}
