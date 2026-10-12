'use client';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PrefsBar } from '@/components/PrefsBar';
import { login } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';

export default function LoginPage() {
  const { t } = usePrefs();
  const router = useRouter();
  const [pin, setPin] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr('');
    try {
      await login(
        pin
          ? { staffCode: String(f.get('staffCode')), pin: String(f.get('pin')) }
          : { email: String(f.get('email')), password: String(f.get('password')) },
        pin,
      );
      router.replace('/admin/products');
    } catch {
      setErr(t.invalidLogin);
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded border border-slate-300 bg-transparent px-3 py-3 dark:border-slate-700';
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.appName}</h1>
        <PrefsBar />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {pin ? (
          <>
            <input
              name="staffCode"
              placeholder={t.staffCode}
              required
              autoFocus
              className={input}
            />
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder={t.pin}
              required
              className={input}
            />
          </>
        ) : (
          <>
            <input
              name="email"
              type="email"
              placeholder={t.email}
              required
              autoFocus
              className={input}
            />
            <input
              name="password"
              type="password"
              placeholder={t.password}
              required
              className={input}
            />
          </>
        )}
        {err && (
          <p role="alert" className="text-red-600">
            {err}
          </p>
        )}
        <button
          disabled={busy}
          className="rounded bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {t.login}
        </button>
        <button type="button" onClick={() => setPin(!pin)} className="text-sm underline">
          {pin ? t.usePassword : t.usePin}
        </button>
      </form>
    </main>
  );
}
