import Link from 'next/link';
import { useState } from 'react';
import { CatMark } from './icons';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
          <Link href="/adopt/profile" className="btn btn-primary btn-sm" onClick={close}>Crear mi perfil</Link>
        </div>
      </nav>
    </header>
  );
}
