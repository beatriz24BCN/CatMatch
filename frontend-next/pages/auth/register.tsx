import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { registerUser, loginUser } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || !email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    if (trimmedName.length > 100) {
      setError('El nombre no puede tener más de 100 caracteres.');
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
      await registerUser({ name: trimmedName, email, password });
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
      <div className="auth-page">
        <section className="auth-card" aria-labelledby="registerTitle">
          <header className="auth-header">
            <p className="auth-eyebrow">Tu primer paso juntos</p>
            <h1 id="registerTitle">Únete a CatMatch</h1>
            <p className="auth-subtitle" id="registerDescription">
              Crea tu cuenta y encuentra a tu compañero ideal.
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
            aria-labelledby="registerTitle"
            aria-describedby="registerDescription"
            noValidate
          >
            <div className="field">
              <label htmlFor="regName">Nombre</label>
              <input
                id="regName"
                name="name"
                type="text"
                autoComplete="given-name"
                required
                maxLength={100}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre (ej. Bea)"
              />
            </div>

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

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
            </button>
          </form>

          <p className="auth-switch">
            <span>¿Ya tienes una cuenta? </span>
            <Link href="/auth/login">Inicia sesión</Link>
          </p>
          <Link href="/" className="auth-guest">
            Seguir explorando gatos sin registrarme
          </Link>
        </section>
      </div>
    </Layout>
  );
}
