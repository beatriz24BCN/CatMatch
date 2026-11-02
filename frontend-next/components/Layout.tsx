import Head from 'next/head';
import { useState, type ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatAssistant from './ChatAssistant';

type Props = { title?: string; description?: string; children: ReactNode };

export default function Layout({ title, description, children }: Props) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantMinimized, setIsAssistantMinimized] = useState(false);
  const fullTitle = title ? `${title} — CatMatch` : 'CatMatch';
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {description && <meta name="description" content={description} />}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <Navbar
        onToggleAssistant={() => {
          if (isAssistantMinimized) {
            setIsAssistantMinimized(false);
            setIsAssistantOpen(true);
          } else {
            setIsAssistantOpen(prev => !prev);
          }
        }}
        isAssistantOpen={isAssistantOpen && !isAssistantMinimized}
      />
      <main>{children}</main>
      <ChatAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        isMinimized={isAssistantMinimized}
        onMinimize={() => setIsAssistantMinimized(true)}
      />
      <Footer />
    </>
  );
}
