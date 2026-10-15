import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>CatMatch</title>
        <meta name="description" content="CatMatch — redirigiendo a Adopta" />
      </Head>
      <main>
        <h1>CatMatch</h1>
        <p>Redirigiendo a la página de adopción...</p>
        <p>If your browser doesn't redirect, <a href="/adopt">go to Adopta</a>.</p>
      </main>
    </>
  );
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/adopt',
      permanent: false,
    },
  };
}
