const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nombre completo',
  bio: 'Biografía',
  location: 'Ubicación',
  activity_level: 'Nivel de actividad',
  home_type: 'Tipo de vivienda',
  home_size: 'Tamaño de la vivienda',
  has_outdoor_space: 'Espacio exterior',
  has_children: 'Niños en casa',
  has_other_pets: 'Otras mascotas',
  preferred_cat_traits: 'Rasgos preferidos',
  contact_email: 'Email de contacto',
  message: 'Mensaje',
  cat_id: 'Gato',
  person_id: 'Perfil',
};

function describeItem(item: any): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const msg = typeof item.msg === 'string' ? item.msg : typeof item.message === 'string' ? item.message : null;
    if (msg) {
      const loc = Array.isArray(item.loc) ? item.loc.filter((p: any) => p !== 'body' && p !== 'query') : [];
      const field = loc.length ? String(loc[loc.length - 1]) : '';
      const label = field ? FIELD_LABELS[field] || field : '';
      return label ? `${label}: ${msg}` : msg;
    }
  }
  return '';
}

// Turns any API error (FastAPI string/array/object detail, Error, string) into text safe to render in JSX.
export function formatApiError(e: any, fallback = 'Ha ocurrido un error'): string {
  const detail = e?.body?.detail ?? e?.body?.message ?? e?.detail ?? e?.message ?? e;
  let text = '';
  if (typeof detail === 'string') {
    text = detail;
  } else if (Array.isArray(detail)) {
    text = detail.map(describeItem).filter(Boolean).join('; ');
  } else if (detail && typeof detail === 'object') {
    text = describeItem(detail);
  }
  if (e?.status === 422 && text) text = `Datos no válidos — ${text}`;
  if (e && typeof e === 'object' && (e.body !== undefined || e.status !== undefined)) {
    console.error('API error', e.status, e.body);
  }
  return text || fallback;
}
