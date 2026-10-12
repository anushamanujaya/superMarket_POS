'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { PrefsBar } from '@/components/PrefsBar';
import { api, logout, tokenStore } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = usePrefs();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) {
      router.replace('/login');
      return;
    }
    api('/auth/me')
      .then(() => setReady(true))
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!ready) return <p className="p-6">{t.loading}</p>;
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <nav className="flex items-center gap-6">
          <strong>{t.appName}</strong>
          <Link href="/admin/products" className="underline-offset-4 hover:underline">
            {t.products}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <PrefsBar />
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          >
            {t.signOut}
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
