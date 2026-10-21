import Head from 'next/head';
import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

type Props = { title?: string; description?: string; children: ReactNode };

export default function Layout({ title, description, children }: Props) {
  const fullTitle = title ? `${title} — CatMatch` : 'CatMatch';
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {description && <meta name="description" content={description} />}
      </Head>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
