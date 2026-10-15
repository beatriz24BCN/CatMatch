import Link from 'next/link';
import type { CatsForPersonItem } from '../types/api';

export default function CatCard({ item }:{ item: CatsForPersonItem }){
  const cat = item.cat as any;
  const match = item.match;
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
        <p style={{margin:'0 0 8px 0'}}>{cat.description || ''}</p>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href={`/adopt/cat/${cat.id}`}><a style={{padding:'6px 10px',background:'#0070f3',color:'#fff',borderRadius:4}}>Ver ficha</a></Link>
          <Link href={`/adopt/cat/${cat.id}/request`}><a style={{padding:'6px 10px',background:'#28a745',color:'#fff',borderRadius:4}}>Solicitar adopción</a></Link>
        </div>
      </div>
      <aside style={{width:220}}>
        <strong>Match</strong>
        <div style={{fontSize:13,marginTop:6}}>
          <div>{match?.explanation}</div>
        </div>
      </aside>
    </article>
  );
}
