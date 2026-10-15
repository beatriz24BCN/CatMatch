import Head from 'next/head';
import Navbar from '../../components/Navbar';
import dynamic from 'next/dynamic';

const ProfileForm = dynamic(()=>import('../../components/ProfileForm'),{ ssr:false });

export default function ProfilePage(){
  return (
    <div>
      <Head><title>Perfil — CatMatch</title></Head>
      <Navbar />
      <main style={{padding:20}}>
        <h1>Perfil de adoptante</h1>
        <ProfileForm />
      </main>
    </div>
  );
}
