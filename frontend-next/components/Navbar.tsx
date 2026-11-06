import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CatMark } from './icons';
import { getMe, logoutUser } from '../lib/api';
import type { UserRead } from '../types/api';

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      style={{ width: 16, height: 16, flexShrink: 0 }}
    >
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Navbar({ onToggleAssistant, isAssistantOpen }: { onToggleAssistant?: () => void; isAssistantOpen?: boolean }) {
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
          <div className="nav-center">
            <Link href="/adopt" onClick={close}>Encontrar gato</Link>
            <Link href="/#como-funciona" onClick={close}>Cómo funciona</Link>

            {user?.role === 'admin' && (
              <Link href="/admin/adoption-requests" onClick={close} style={{ fontWeight: 600 }}>
                Panel admin
              </Link>
            )}
          </div>

          <div className="nav-actions">
            {onToggleAssistant && (
              <button
                type="button"
                onClick={() => {
                  onToggleAssistant();
                  close();
                }}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                aria-expanded={isAssistantOpen}
              >
                <span>🐱</span> Matcher
              </button>
            )}

            {user ? (
              <div className="nav-user" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--green-900)',
                  }}
                >
                  <UserIcon />
                  <span>{user.name?.trim() || 'Mi cuenta'}</span>
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
              <Link href="/auth/login" onClick={close} className="nav-btn-login">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
