import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CatMark } from './icons';
import { getMe, logoutUser } from '../lib/api';
import type { UserRead } from '../types/api';

export default function Navbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserRead | null>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then(u => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [router.asPath]);

  async function handleLogout() {
    try {
      await logoutUser();
      setUser(null);
      close();
      router.push('/');
    } catch {
      // Ignorar error al cerrar sesión
      setUser(null);
      close();
    }
  }

  return (
    <header className="navbar">
      <nav className="container navbar-inner" aria-label="Principal">
        <Link href="/" className="brand" onClick={close}>
          <CatMark className="brand-mark" />
          CatMatch
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen(o => !o)}
        >
          {open ? '✕' : '☰'}
        </button>
        <div id="nav-links" className={`nav-links${open ? ' open' : ''}`}>
          <Link href="/adopt" onClick={close}>Encontrar gato</Link>
          <Link href="/#como-funciona" onClick={close}>Cómo funciona</Link>

          {user?.role === 'admin' && (
            <Link href="/admin/adoption-requests" onClick={close} style={{ fontWeight: 600 }}>
              Panel admin
            </Link>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="muted" style={{ fontSize: '0.88rem' }} title={`Conectado como ${user.email}`}>
                {user.email.split('@')[0]}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 10px' }}
              >
                Salir
              </button>
            </div>
          ) : (
            <Link href="/auth/login" onClick={close}>
              Iniciar sesión
            </Link>
          )}

          <Link href="/adopt/profile" className="btn btn-primary btn-sm" onClick={close}>
            Crear mi perfil
          </Link>
        </div>
      </nav>
    </header>
  );
}
