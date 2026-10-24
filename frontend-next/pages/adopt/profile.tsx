import Layout from '../../components/Layout';
import dynamic from 'next/dynamic';

const ProfileForm = dynamic(()=>import('../../components/ProfileForm'),{ ssr:false });

export default function ProfilePage(){
  return (
    <Layout title="Mi perfil">
      <div className="page-narrow page">
        <h1>Cuéntanos cómo vives</h1>
        <p className="lead" style={{marginBottom:20}}>Sin cuenta ni registro. Usaremos estos datos solo para calcular qué gatos encajan contigo.</p>
        <ProfileForm />
      </div>
    </Layout>
  );
}
