import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PrefsProvider } from '@/lib/prefs';
import './globals.css';

export const metadata: Metadata = { title: 'Supermarket POS' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
