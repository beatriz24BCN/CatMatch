import Head from 'next/head';
import Navbar from '../../components/Navbar';
import { useEffect, useState } from 'react';
import { listAdoptionRequests, updateAdoptionRequestStatus } from '../../lib/api';
import type { AdoptionRequestRead } from '../../types/api';

const STATUS_LABELS: { [k: string]: string } = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  accepted: 'Aceptada',
  rejected: 'No aceptada',
};

export default function AdminAdoptionRequests(){
  const [items, setItems] = useState<AdoptionRequestRead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  async function load(){
    setError(null);
    setLoading(true);
    try{
      const data = await listAdoptionRequests(filterStatus);
      setItems(Array.isArray(data) ? data : []);
    }catch(e:any){
      setError(e?.body?.detail || e?.message || 'Error cargando solicitudes');
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ load(); }, [filterStatus]);

  async function changeStatus(req: AdoptionRequestRead, newStatus: string){
    if(!req?.id) return;
    if(updatingId) return; // single update at a time
    setError(null);
    setUpdatingId(req.id);
    try{
      const updated = await updateAdoptionRequestStatus(req.id, newStatus);
      // update local state only after server confirms
      setItems(prev => prev ? prev.map(p => p.id === req.id ? updated : p) : prev);
    }catch(e:any){
      setError(e?.body?.detail || e?.message || 'Error actualizando estado');
    }finally{ setUpdatingId(null); }
  }

  return (
    <div>
      <Head><title>Administrar solicitudes de adopción</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Solicitudes de adopción</h1>

        <div style={{marginBottom:12}}>
          <label htmlFor="filterStatus">Filtrar por estado</label>{' '}
          <select id="filterStatus" value={filterStatus || ''} onChange={e=>setFilterStatus(e.target.value || undefined)}>
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="in_review">En revisión</option>
            <option value="accepted">Aceptada</option>
            <option value="rejected">No aceptada</option>
          </select>
          <button style={{marginLeft:8}} onClick={load}>Recargar</button>
        </div>

        {loading && <div>Cargando solicitudes...</div>}
        {error && <div role="alert" style={{color:'red',marginTop:8}}>{error}</div>}

        {!loading && items && items.length === 0 && (
          <div style={{color:'#666'}}>No hay solicitudes que mostrar.</div>
        )}

        {!loading && items && items.length > 0 && (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>ID</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>Gato</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>Contacto</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>Mensaje</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>Estado</th>
                <th style={{textAlign:'left',borderBottom:'1px solid #eee',padding:8}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(req => (
                <tr key={req.id} style={{borderBottom:'1px solid #f4f4f4'}}>
                  <td style={{padding:8,fontSize:12}}>{req.id}</td>
                  <td style={{padding:8,fontSize:13}}>{req.cat_id}</td>
                  <td style={{padding:8}}>{req.contact_email}{req.contact_phone ? ` · ${req.contact_phone}` : ''}</td>
                  <td style={{padding:8,whiteSpace:'pre-wrap',maxWidth:360}}>{req.message || ''}</td>
                  <td style={{padding:8}}>{STATUS_LABELS[req.status || 'pending'] || (req.status || 'Desconocido')}</td>
                  <td style={{padding:8}}>
                    <div style={{display:'flex',gap:8}}>
                      <button disabled={updatingId === req.id} onClick={()=>changeStatus(req,'in_review')} aria-disabled={updatingId === req.id}>{updatingId === req.id ? 'Actualizando...' : 'Marcar en revisión'}</button>
                      <button disabled={updatingId === req.id} onClick={()=>changeStatus(req,'accepted')} aria-disabled={updatingId === req.id}>Aceptar</button>
                      <button disabled={updatingId === req.id} onClick={()=>changeStatus(req,'rejected')} aria-disabled={updatingId === req.id}>Rechazar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </main>
    </div>
  );
}
