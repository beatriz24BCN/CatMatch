import Layout from '../../components/Layout';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import CatTile from '../../components/CatTile';
import { CatSilhouette } from '../../components/icons';
import { listCats } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';
import type { Cat } from '../../types/api';

export default function AdoptIndex(){
  const [hasProfile, setHasProfile] = useState(false);
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros soportados
  const [location, setLocation] = useState('');
  const [ageStage, setAgeStage] = useState('');
  const [activityLevel, setActivityLevel] = useState('');

  useEffect(()=>{
    try{ setHasProfile(!!localStorage.getItem('catmatch_person_id')); }catch(e){ /* storage unavailable */ }
  },[]);

  async function fetchCats(){
    setLoading(true);
    setError(null);
    try {
      const data = await listCats({
        location: location.trim() || undefined,
        age_stage: ageStage || undefined,
        activity_level: activityLevel || undefined,
      });
      setCats(Array.isArray(data) ? data : []);
    } catch(err: any) {
      setError(formatApiError(err, 'No se ha podido cargar el catálogo de gatos.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCats();
  }, [location, ageStage, activityLevel]);

  return (
    <Layout title="Gatos en adopción" description="Explora los gatos disponibles para adopción en CatMatch">
      <div className="container page">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div>
            <h1>Gatos en adopción</h1>
            <p className="lead" style={{ margin: 0 }}>
              Explora todos los gatos del refugio o crea tu perfil para obtener recomendaciones personalizadas de compatibilidad.
            </p>
          </div>
          <div className="btn-row">
            <Link href="/adopt/profile" className="btn btn-primary">
              {hasProfile ? 'Editar mi perfil' : 'Crear mi perfil'}
            </Link>
            {hasProfile && <Link href="/adopt/results" className="btn btn-secondary">Mis recomendaciones</Link>}
          </div>
        </div>

        {/* Barra de filtros */}
        <section className="card" style={{ padding: '16px 20px', marginBottom: 28 }} aria-label="Filtros del catálogo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="filterLocation">Ubicación</label>
              <input
                id="filterLocation"
                type="text"
                placeholder="Ej: Barcelona"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="filterAge">Edad</label>
              <select id="filterAge" value={ageStage} onChange={e => setAgeStage(e.target.value)}>
                <option value="">Todas las edades</option>
                <option value="kitten">Cachorro</option>
                <option value="young">Joven</option>
                <option value="adult">Adulto</option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="filterActivity">Nivel de actividad</label>
              <select id="filterActivity" value={activityLevel} onChange={e => setActivityLevel(e.target.value)}>
                <option value="">Cualquier nivel</option>
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
                <option value="very_high">Muy alto</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setLocation(''); setAgeStage(''); setActivityLevel(''); }}
                style={{ width: '100%' }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <div className="loading" role="status" aria-live="polite">
            <span className="spinner" /> Cargando catálogo de gatos…
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && cats && cats.length === 0 && (
          <div className="empty">
            <CatSilhouette className="empty-icon" />
            <h3>No se encontraron gatos con estos filtros</h3>
            <p>Prueba a cambiar o limpiar los filtros para ver otros compañeros felinos.</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setLocation(''); setAgeStage(''); setActivityLevel(''); }}
            >
              Ver todos los gatos
            </button>
          </div>
        )}

        {!loading && !error && cats && cats.length > 0 && (
          <div className="grid-cats grid-cats-catalog">
            {cats.map(c => (
              <CatTile key={c.id} cat={c} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
