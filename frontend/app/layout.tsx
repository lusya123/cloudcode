import './globals.css';
import type { ReactNode } from 'react';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';

const space = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700']
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500']
});

export const metadata = {
  title: 'CloudClaude',
  description: 'CloudClaude management console'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${space.variable} ${plexMono.variable}`}>
      <body>
        <div className="min-h-screen main-grid">
          <Header />
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:flex-row">
            <Sidebar />
            <main className="flex-1 animate-rise">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
