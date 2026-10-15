import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Link from 'next/link';

export default function AdoptIndex(){
  return (
    <div>
      <Head><title>Adopta — CatMatch</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Adopta</h1>
        <p>Empieza el proceso creando tu perfil y luego revisa gatos sugeridos.</p>
        <div style={{display:'flex',gap:12}}>
          <Link href="/adopt/profile" style={{padding:12,background:'#0070f3',color:'#fff',borderRadius:6}}>Crear perfil</Link>
          <Link href="/adopt/results" style={{padding:12,background:'#6c757d',color:'#fff',borderRadius:6}}>Ver resultados (si ya tienes perfil)</Link>
        </div>
      </main>
    </div>
  );
}
