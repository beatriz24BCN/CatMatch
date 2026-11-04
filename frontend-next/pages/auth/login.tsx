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
  const [rememberMe, setRememberMe] = useState(false);
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
      await loginUser({ email, password, remember_me: rememberMe });
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
      <div className="auth-page">
        <section className="auth-card" aria-labelledby="loginTitle">
          <header className="auth-header">
            <p className="auth-eyebrow" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '18px' }}>CatMatch</p>
            <h1 id="loginTitle">¡Qué alegría verte de nuevo!</h1>
            <p className="auth-subtitle" id="loginDescription">
              Entra y sigue buscando a tu compañero ideal
            </p>
          </header>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="auth-form"
            aria-labelledby="loginTitle"
            aria-describedby="loginDescription"
            noValidate
          >
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

            <div className="login-options">
              <label className="checkbox-inline" htmlFor="loginRemember">
                <input
                  id="loginRemember"
                  name="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Recordarme</span>
              </label>
              <Link href="/auth/forgot-password" className="login-forgot">
                ¿Has olvidado tu contraseña?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="auth-switch">
            <span>¿Todavía no tienes cuenta? </span>
            <Link href="/auth/register">Regístrate</Link>
          </p>
          <Link href="/" className="auth-guest">
            Seguir explorando gatos sin registrarme
          </Link>
        </section>
      </div>
    </Layout>
  );
}
