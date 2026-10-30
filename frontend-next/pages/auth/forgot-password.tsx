import { useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import { fetchDevResetOutbox, requestPasswordReset, type DevResetOutboxItem } from '../../lib/api';
import { formatApiError } from '../../lib/formatError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devLinks, setDevLinks] = useState<DevResetOutboxItem[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccess(null);
    setDevLinks(null);

    if (!email.trim()) {
      setError('Por favor, introduce tu correo electrónico.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSuccess(res.message);
      if (process.env.NODE_ENV !== 'production') {
        // Solo desarrollo: si el backend tiene activado el buzón, mostrar el enlace en lugar de enviar correo.
        try {
          setDevLinks(await fetchDevResetOutbox(email.trim()));
        } catch {
          setDevLinks(null);
        }
      }
    } catch (err: any) {
      setError(formatApiError(err, 'No se ha podido procesar la solicitud. Inténtalo de nuevo más tarde.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout title="Recuperar contraseña" description="Solicita un enlace para restablecer tu contraseña de CatMatch">
      <div className="page-narrow page">
        <h1>Recuperar contraseña</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Introduce el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
        </p>

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status" style={{ marginBottom: 20 }}>
            {success} Revisa también la carpeta de correo no deseado. El enlace caduca en poco tiempo y solo puede usarse una vez.
          </div>
        )}

        {process.env.NODE_ENV !== 'production' && devLinks && (
          <div className="alert dev-outbox" role="status" style={{ marginBottom: 20 }}>
            <strong>Modo desarrollo: no se ha enviado ningún correo.</strong>
            {devLinks.length > 0 ? (
              <>
                <p>Enlace de recuperación generado (un solo uso, caduca en 30 minutos):</p>
                <a href={devLinks[0].reset_path} className="btn btn-primary">
                  Abrir enlace de recuperación
                </a>
              </>
            ) : (
              <p>No hay enlaces pendientes para este correo (cuenta inexistente o inactiva, solicitud demasiado seguida o enlace ya usado).</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card form-card" noValidate>
          <div className="field">
            <label htmlFor="forgotEmail">Correo electrónico</label>
            <input
              id="forgotEmail"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
            <Link href="/auth/login" className="btn btn-ghost">
              Volver al inicio de sesión
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
