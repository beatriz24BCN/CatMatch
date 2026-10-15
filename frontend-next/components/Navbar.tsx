import Link from 'next/link';

export default function Navbar() {
  return (
    <nav style={{display:'flex',gap:20,alignItems:'center',padding:12,borderBottom:'1px solid #eee'}}>
      <Link href="/" style={{fontWeight:700}}>CatMatch</Link>
      <div style={{flex:1}} />
      <Link href="/">Inicio</Link>
      <Link href="/adopt">Adopta</Link>
      <Link href="/about">Sobre nosotros</Link>
      <Link href="/contact">Contacto</Link>
    </nav>
  );
}
