import Link from 'next/link';

export default function Navbar() {
  return (
    <nav style={{display:'flex',gap:20,alignItems:'center',padding:12,borderBottom:'1px solid #eee'}}>
      <Link href="/"> <a style={{fontWeight:700}}>CatMatch</a></Link>
      <div style={{flex:1}} />
      <Link href="/"> <a>Inicio</a></Link>
      <Link href="/adopt"> <a>Adopta</a></Link>
      <Link href="/about"> <a>Sobre nosotros</a></Link>
      <Link href="/contact"> <a>Contacto</a></Link>
    </nav>
  );
}
