import Layout from '../../components/Layout';
import { useEffect, useState } from 'react';
import { listAdoptionRequests, updateAdoptionRequestStatus } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';
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
      setError(formatApiError(e, 'Error cargando solicitudes'));
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
      setError(formatApiError(e, 'Error actualizando estado'));
    }finally{ setUpdatingId(null); }
  }

  return (
    <Layout title="Administrar solicitudes">
      <div className="container page">
        <h1>Solicitudes de adopción</h1>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="filterStatus">Filtrar por estado</label>
            <select id="filterStatus" value={filterStatus || ''} onChange={e=>setFilterStatus(e.target.value || undefined)}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En revisión</option>
              <option value="accepted">Aceptada</option>
              <option value="rejected">No aceptada</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>Recargar</button>
        </div>

        {loading && <div className="loading" role="status" aria-live="polite"><span className="spinner" />Cargando solicitudes…</div>}
        {error && <div role="alert" className="alert alert-error">{error}</div>}

        {!loading && items && items.length === 0 && (
          <div className="empty"><h3>No hay solicitudes</h3><p>Cuando alguien solicite adoptar un gato, aparecerá aquí.</p></div>
        )}

        {!loading && items && items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Gato</th><th>Contacto</th><th>Mensaje</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(req => {
                  const st = req.status || 'pending';
                  const badge = st === 'accepted' ? 'badge-ok' : st === 'rejected' ? 'badge-danger' : st === 'in_review' ? 'badge-warn' : '';
                  return (
                    <tr key={req.id}>
                      <td data-label="ID" className="mono">{req.id}</td>
                      <td data-label="Gato" className="mono">{req.cat_id}</td>
                      <td data-label="Contacto">{req.contact_email}{req.contact_phone ? ` · ${req.contact_phone}` : ''}</td>
                      <td data-label="Mensaje" style={{whiteSpace:'pre-wrap',maxWidth:360}}>{req.message || ''}</td>
                      <td data-label="Estado"><span className={`badge ${badge}`}>{STATUS_LABELS[st] || st}</span></td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-secondary btn-sm" disabled={updatingId === req.id} onClick={()=>changeStatus(req,'in_review')}>{updatingId === req.id ? 'Actualizando...' : 'Marcar en revisión'}</button>
                          <button className="btn btn-primary btn-sm" disabled={updatingId === req.id} onClick={()=>changeStatus(req,'accepted')}>Aceptar</button>
                          <button className="btn btn-secondary btn-sm" disabled={updatingId === req.id} onClick={()=>changeStatus(req,'rejected')}>Rechazar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </Layout>
  );
}
