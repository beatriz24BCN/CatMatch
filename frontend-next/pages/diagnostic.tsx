import { useState } from 'react'

export default function DiagnosticPage() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const samplePerson = {
    id: null,
    name: 'Test Person',
    has_children: false,
    good_with_children: true,
    has_other_pets: false,
    good_with_dogs: true,
    location: 'Testville',
    activity_level: 'medium',
    personality: 'calm,patient',
  }

  const sampleCat = {
    id: null,
    name: 'Test Cat',
    good_with_children: true,
    good_with_dogs: true,
    location: 'Testville',
    activity_level: 'low',
    personality: 'calm',
  }

  async function runTest() {
    setLoading(true)
    setResult(null)
    try {
      const resp = await fetch('/api/diag-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, person: samplePerson, cat: sampleCat }),
      })

      const text = await resp.text()
      setResult(`Status: ${resp.status}\n\n${text}`)
    } catch (err: any) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Diagnóstico: POST /api/match/evaluate</h1>
      <p>
        Esta página envía una petición de prueba autocontenida (person + cat) al endpoint de matching del
        backend a través de la ruta servidor /api/diag-evaluate para evitar problemas de CORS.
      </p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        URL base del backend:
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={{ width: '100%', padding: 8, marginTop: 6 }}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        <button onClick={runTest} disabled={loading} style={{ padding: '8px 12px' }}>
          {loading ? 'Ejecutando...' : 'Enviar petición de diagnóstico'}
        </button>
      </div>

      {result && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#f6f8fa', padding: 12 }}>
          {result}
        </pre>
      )}

      <section style={{ marginTop: 20 }}>
        <h2>Notas</h2>
        <ul>
          <li>La petición es autocontenida y no debería escribir en la base de datos.</li>
          <li>
            Si el backend no está en <code>http://localhost:8000</code> ajuste la URL base arriba (p. ej. la
            IP del host o la dirección del contenedor accesible desde este entorno).
          </li>
          <li>Si aparece un error de CORS, la ruta /api/diag-evaluate lo evitará porque ejecuta la petición desde el
            servidor Next.js.</li>
        </ul>
      </section>
    </main>
  )
}
