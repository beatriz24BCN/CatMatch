import Link from 'next/link';
import { CatSilhouette } from './icons';
import { AGE_LABELS } from '../lib/labels';

// Compact card for a cat record coming from GET /api/cats/ (no matching data).
export default function CatTile({ cat }: { cat: any }) {
  const photo = Array.isArray(cat?.image_urls) ? cat.image_urls[0] : null;
  const age = AGE_LABELS[cat?.age_stage] || cat?.age_stage;
  return (
    <article className="card cat-tile" aria-label={`Gato ${cat?.name || 'sin nombre'}`}>
      <div className="cat-photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={cat?.name ? `Foto de ${cat.name}` : 'Foto del gato'} loading="lazy" />
        ) : (
          <CatSilhouette />
        )}
      </div>
      <div className="cat-body">
        <h3>{cat?.name || 'Sin nombre'}</h3>
        <div className="cat-meta">
          {age}{cat?.age_months ? ` · ${cat.age_months} meses` : ''}
          {cat?.location ? ` · ${cat.location}` : ''}
        </div>
        {cat?.description && <p className="cat-desc">{cat.description}</p>}
        <div className="cat-actions">
          <Link href={`/adopt/cat/${cat.id}`} className="btn btn-secondary btn-sm">Ver ficha</Link>
        </div>
      </div>
    </article>
  );
}
