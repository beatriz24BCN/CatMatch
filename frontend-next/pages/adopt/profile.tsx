import Layout from '../../components/Layout';
import dynamic from 'next/dynamic';

const ProfileForm = dynamic(()=>import('../../components/ProfileForm'),{ ssr:false });

export default function ProfilePage(){
  return (
    <Layout title="Mi perfil de adoptante">
      <div className="page-narrow page">
        <h1>Cuéntanos cómo vives</h1>
        <p className="lead" style={{marginBottom:12}}>Sin cuenta ni registro. Usaremos estos datos solo para calcular qué gatos encajan contigo.</p>
        <div style={{ marginBottom: 20, padding: '10px 14px', background: 'var(--surface-alt, #f8fafc)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--muted, #64748b)', border: '1px solid var(--border, #e2e8f0)' }}>
          💡 <strong>Consejo:</strong> También puedes usar <strong>Matcher</strong> desde la barra superior para explorar gatos compatibles de forma conversacional sin rellenar formularios extensos.
        </div>
        <ProfileForm />
      </div>
    </Layout>
  );
}
