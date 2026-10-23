import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { loginUser } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email || !password) {
      setError('Por favor, introduce tu email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await loginUser({ email, password });
      // Redirigir a la URL previa o a la portada
      const next = (router.query.next as string) || '/';
      router.push(next);
    } catch (err: any) {
      setError(formatApiError(err, 'Credenciales incorrectas o error en el inicio de sesión.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Iniciar sesión" description="Accede a tu cuenta de CatMatch">
      <div className="page-narrow page">
        <h1>Iniciar sesión</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Accede a tu cuenta de CatMatch. (Recuerda que puedes explorar gatos y solicitar adopción sin necesidad de registrarte).
        </p>

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card form-card" noValidate>
          <div className="field">
            <label htmlFor="loginEmail">Correo electrónico</label>
            <input
              id="loginEmail"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          <div className="field">
            <label htmlFor="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
            <Link href="/" className="btn btn-ghost">
              Cancelar
            </Link>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: '0.95rem' }}>
            <span className="muted">¿No tienes cuenta todavía? </span>
            <Link href="/auth/register" style={{ fontWeight: 600 }}>
              Regístrate aquí
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
