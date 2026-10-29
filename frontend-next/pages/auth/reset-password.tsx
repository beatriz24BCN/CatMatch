import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { confirmPasswordReset } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // El token llega en el fragmento (#token=...), que el navegador no envía al servidor.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const value = params.get('token');
    if (value) {
      setToken(value);
      // Quitar el token de la barra de direcciones y del historial
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setTokenChecked(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !token) return;
    setError(null);

    if (!password || !confirmPassword) {
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
      const res = await confirmPasswordReset(token, password);
      setSuccess(res.message);
      setToken(null);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(formatApiError(err, 'No se ha podido restablecer la contraseña. Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Nueva contraseña" description="Elige una contraseña nueva para tu cuenta de CatMatch">
      <div className="page-narrow page">
        <h1>Nueva contraseña</h1>

        {success ? (
          <>
            <div className="alert alert-success" role="status" style={{ marginBottom: 20 }}>
              {success} Por seguridad, se han cerrado las sesiones abiertas en otros dispositivos.
            </div>
            <Link href="/auth/login" className="btn btn-primary">
              Iniciar sesión
            </Link>
          </>
        ) : tokenChecked && !token ? (
          <>
            <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
              El enlace de recuperación no es válido o está incompleto. Abre el enlace completo del correo o solicita uno nuevo.
            </div>
            <Link href="/auth/forgot-password" className="btn btn-primary">
              Solicitar un enlace nuevo
            </Link>
          </>
        ) : (
          <>
            <p className="lead" style={{ marginBottom: 24 }}>
              Elige una contraseña nueva para tu cuenta. Al guardarla se cerrarán las sesiones abiertas en otros dispositivos.
            </p>

            {error && (
              <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
                {error}{' '}
                <Link href="/auth/forgot-password" style={{ fontWeight: 600 }}>
                  Solicitar un enlace nuevo
                </Link>
              </div>
            )}

            <form onSubmit={handleSubmit} className="card form-card" noValidate>
              <div className="field">
                <label htmlFor="resetPassword">Contraseña nueva (mínimo 8 caracteres)</label>
                <input
                  id="resetPassword"
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
                <label htmlFor="resetConfirmPassword">Confirmar contraseña nueva</label>
                <input
                  id="resetConfirmPassword"
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
                <button type="submit" className="btn btn-primary" disabled={loading || !token}>
                  {loading ? 'Guardando…' : 'Guardar contraseña nueva'}
                </button>
                <Link href="/auth/login" className="btn btn-ghost">
                  Cancelar
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </Layout>
  );
}
