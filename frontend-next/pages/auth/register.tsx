import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { registerUser, loginUser } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // 1. Registrar usuario
      await registerUser({ email, password });
      // 2. Iniciar sesión automáticamente
      await loginUser({ email, password });
      router.push('/');
    } catch (err: any) {
      setError(formatApiError(err, 'Error al registrar la cuenta. Comprueba que el correo no esté ya en uso.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Crear cuenta" description="Regístrate en CatMatch">
      <div className="page-narrow page">
        <h1>Crear cuenta</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Crea una cuenta en CatMatch. Recuerda que la cuenta es completamente opcional: siempre puedes adoptar y hacer matching sin registrarte.
        </p>

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card form-card" noValidate>
          <div className="field">
            <label htmlFor="regEmail">Correo electrónico</label>
            <input
              id="regEmail"
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
            <label htmlFor="regPassword">Contraseña (mínimo 8 caracteres)</label>
            <input
              id="regPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
            </button>
            <Link href="/" className="btn btn-ghost">
              Cancelar
            </Link>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: '0.95rem' }}>
            <span className="muted">¿Ya tienes una cuenta? </span>
            <Link href="/auth/login" style={{ fontWeight: 600 }}>
              Inicia sesión aquí
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
