import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'CloudClaude',
  description: 'CloudClaude admin console'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen">
            <Header />
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-6 md:flex-row">
              <Sidebar />
              <main className="flex-1 fade-in">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
