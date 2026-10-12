'use client';
import { LOCALES, Locale } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';

export function PrefsBar() {
  const { locale, setLocale, dark, toggleDark } = usePrefs();
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} className="text-black">
            {l.label}
          </option>
        ))}
      </select>
      <button
        onClick={toggleDark}
        aria-label="Toggle dark mode"
        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
      >
        {dark ? '☀' : '☾'}
      </button>
    </div>
  );
}
