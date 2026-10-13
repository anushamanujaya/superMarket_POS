'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney, toMinor } from '@/lib/money';
import { usePrefs } from '@/lib/prefs';

interface Product {
  id: string;
  sku: string;
  name: { en: string; si?: string; ta?: string };
  category: { name: { en: string } };
  variants: { priceMinor: number; barcodes: { code: string }[] }[];
}
interface Named {
  id: string;
  code?: string;
  name: string | { en: string };
}

const label = (n: Named['name']) => (typeof n === 'string' ? n : n.en);

export default function ProductsPage() {
  const { t, locale } = usePrefs();
  const { can } = useAuth();
  const canWrite = can('catalog.write');
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [cats, setCats] = useState<Named[]>([]);
  const [uoms, setUoms] = useState<Named[]>([]);
  const [taxes, setTaxes] = useState<Named[]>([]);

  const load = useCallback(
    async (search: string) => {
      setLoading(true);
      try {
        const r = await api<{ items: Product[] }>(
          `/products?pageSize=100${search ? `&q=${encodeURIComponent(search)}` : ''}`,
        );
        setItems(r.items);
      } catch {
        setErr(t.error);
      } finally {
        setLoading(false);
      }
    },
    [t.error],
  );

  useEffect(() => {
    const h = setTimeout(() => void load(q), 250);
    return () => clearTimeout(h);
  }, [q, load]);

  useEffect(() => {
    void Promise.all([
      api<Named[]>('/categories'),
      api<Named[]>('/uoms'),
      api<Named[]>('/tax-classes'),
    ])
      .then(([c, u, x]) => {
        setCats(c);
        setUoms(u);
        setTaxes(x);
      })
      .catch(() => setErr(t.error));
  }, [t.error]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr('');
    try {
      const code = String(f.get('barcode')).trim();
      await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: String(f.get('sku')),
          name: { en: String(f.get('name')) },
          categoryId: f.get('categoryId'),
          uomId: f.get('uomId'),
          taxClassId: f.get('taxClassId'),
          priceMinor: toMinor(String(f.get('price'))),
          barcodes: code ? [{ code }] : [],
        }),
      });
      setAdding(false);
      await load(q);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : t.error);
    }
  }

  async function remove(id: string) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      await load(q);
    } catch {
      setErr(t.error);
    }
  }

  const input = 'rounded border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-700';
  const select = (name: string, opts: Named[]) => (
    <select name={name} required className={input}>
      {opts.map((o) => (
        <option key={o.id} value={o.id} className="text-black">
          {label(o.name)}
        </option>
      ))}
    </select>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{t.products}</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className={`${input} min-w-72 flex-1`}
        />
        {canWrite && (
          <button
            onClick={() => setAdding(!adding)}
            className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white"
          >
            {t.addProduct}
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="text-red-600">
          {err}
        </p>
      )}

      {canWrite && adding && (
        <form
          onSubmit={create}
          className="grid grid-cols-1 gap-3 rounded border border-slate-200 p-4 sm:grid-cols-3 dark:border-slate-800"
        >
          <input name="sku" placeholder={t.sku} required className={input} />
          <input name="name" placeholder={t.name} required className={input} />
          <input
            name="price"
            placeholder={`${t.price} (e.g. 125.50)`}
            required
            pattern="\d+(\.\d{1,2})?"
            className={input}
          />
          {select('categoryId', cats)}
          {select('uomId', uoms)}
          {select('taxClassId', taxes)}
          <input name="barcode" placeholder={t.barcode} className={input} />
          <div className="flex gap-2 sm:col-span-2">
            <button className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white">
              {t.save}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded border px-4 py-2"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2">{t.sku}</th>
              <th>{t.name}</th>
              <th>{t.category}</th>
              <th>{t.barcode}</th>
              <th className="text-right">{t.price}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-4">
                  {t.loading}
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4">
                  {t.noResults}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-900">
                <td className="py-2 font-mono text-sm">{p.sku}</td>
                <td>{p.name[locale] ?? p.name.en}</td>
                <td>{p.category.name.en}</td>
                <td className="font-mono text-sm">{p.variants[0]?.barcodes[0]?.code}</td>
                <td className="text-right tabular-nums">
                  {p.variants[0] && formatMoney(p.variants[0].priceMinor)}
                </td>
                <td className="text-right">
                  {canWrite && (
                    <button onClick={() => remove(p.id)} className="text-red-600 underline">
                      {t.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
