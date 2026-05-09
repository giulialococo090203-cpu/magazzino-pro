import React, { useEffect, useMemo, useState } from 'react';
import * as store from '../data/store';

const CACHE_KEY = 'magazzino_dashboard_fast_cache_v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...data,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch {
    // cache non indispensabile
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

async function safeCall(fn, fallback) {
  try {
    if (typeof fn !== 'function') return fallback;
    const result = await fn();
    return result ?? fallback;
  } catch (err) {
    console.warn('[Dashboard fast] chiamata saltata:', err);
    return fallback;
  }
}

function getQty(item) {
  return Number(
    item?.quantity ??
      item?.qty ??
      item?.quantita ??
      item?.stock ??
      item?.currentStock ??
      item?.giacenza ??
      0
  );
}

function isExitMovement(item) {
  const raw = String(
    item?.type ??
      item?.tipo ??
      item?.movementType ??
      item?.direction ??
      item?.causale ??
      ''
  ).toLowerCase();

  return (
    raw.includes('uscita') ||
    raw.includes('scarico') ||
    raw.includes('exit') ||
    raw.includes('out')
  );
}

function getMovementDate(item) {
  return (
    item?.date ??
    item?.data ??
    item?.created_at ??
    item?.createdAt ??
    item?.timestamp ??
    ''
  );
}

function getMaterialName(item) {
  return (
    item?.material_name ??
    item?.materialName ??
    item?.materiale ??
    item?.material?.name ??
    item?.name ??
    item?.codice ??
    item?.sku ??
    'Materiale'
  );
}

function DashboardCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-orange-500/20 bg-zinc-950/80 p-5 shadow-xl shadow-black/20">
      <div className="text-sm uppercase tracking-[0.18em] text-orange-300/80">
        {title}
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      {subtitle ? (
        <div className="mt-2 text-sm text-zinc-400">{subtitle}</div>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const cached = useMemo(() => readCache(), []);

  const [materials, setMaterials] = useState(cached?.materials ?? []);
  const [categories, setCategories] = useState(cached?.categories ?? []);
  const [notifications, setNotifications] = useState(cached?.notifications ?? []);
  const [recentMovements, setRecentMovements] = useState(cached?.recentMovements ?? []);
  const [usersCount, setUsersCount] = useState(cached?.usersCount ?? null);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(cached?.cachedAt ?? null);

  useEffect(() => {
    let alive = true;
    const timers = [];

    const save = (patch) => {
      if (!alive) return;

      const next = {
        materials,
        categories,
        notifications,
        recentMovements,
        usersCount,
        ...patch,
      };

      writeCache(next);
      setLastUpdate(new Date().toISOString());
    };

    // Primo blocco leggero: niente movimenti globali.
    Promise.all([
      safeCall(() => store.materialStore?.getAll?.(), []),
      safeCall(() => store.categoryStore?.getAll?.(), []),
      safeCall(() => store.notificationStore?.getAll?.(), []),
    ]).then(([matsRaw, catsRaw, notsRaw]) => {
      if (!alive) return;

      const nextMaterials = toArray(matsRaw);
      const nextCategories = toArray(catsRaw);
      const nextNotifications = toArray(notsRaw);

      setMaterials(nextMaterials);
      setCategories(nextCategories);
      setNotifications(nextNotifications);

      save({
        materials: nextMaterials,
        categories: nextCategories,
        notifications: nextNotifications,
      });
    });

    // Movimenti recenti soltanto, dopo il primo render.
    timers.push(
      window.setTimeout(() => {
        safeCall(() => store.movementStore?.getRecent?.(12), []).then((raw) => {
          if (!alive) return;
          const nextRecent = toArray(raw);
          setRecentMovements(nextRecent);
          save({ recentMovements: nextRecent });
        });
      }, 600)
    );

    // Utenti dopo, non bloccante.
    timers.push(
      window.setTimeout(() => {
        safeCall(() => store.userStore?.getAll?.(), []).then((raw) => {
          if (!alive) return;
          const count = toArray(raw).length;
          setUsersCount(count);
          save({ usersCount: count });
        });
      }, 1000)
    );

    return () => {
      alive = false;
      timers.forEach(window.clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const lowStock = materials.filter((m) => {
      const qty = getQty(m);
      const min = Number(m?.minStock ?? m?.min_stock ?? m?.scortaMinima ?? 0);
      return min > 0 && qty <= min;
    }).length;

    const exits = recentMovements.filter(isExitMovement);
    const entries = recentMovements.length - exits.length;

    return {
      materialsCount: materials.length,
      categoriesCount: categories.length,
      notificationsCount: notifications.length,
      lowStock,
      entries,
      exits: exits.length,
    };
  }, [materials, categories, notifications, recentMovements]);

  async function loadUsageManually() {
    setUsageLoading(true);

    const result = await safeCall(() => {
      if (typeof store.getSupabaseUsageMonitor === 'function') {
        return store.getSupabaseUsageMonitor();
      }
      if (typeof store.supabaseUsageMonitor?.get === 'function') {
        return store.supabaseUsageMonitor.get();
      }
      return null;
    }, null);

    setUsage(result);
    setUsageLoading(false);
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-orange-400">
              Magazzino Pro
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Apertura rapida con dati progressivi. I movimenti caricati in home
              sono solo gli ultimi 12.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs text-orange-200">
              {lastUpdate
                ? `Aggiornata: ${new Date(lastUpdate).toLocaleString('it-IT')}`
                : 'Dashboard pronta'}
            </div>

            <button
              type="button"
              onClick={loadUsageManually}
              disabled={usageLoading}
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-60"
            >
              {usageLoading ? 'Controllo memoria...' : 'Controlla memoria Supabase'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Materiali"
            value={stats.materialsCount}
            subtitle="Anagrafica caricata subito"
          />
          <DashboardCard
            title="Categorie"
            value={stats.categoriesCount}
            subtitle="Dati base magazzino"
          />
          <DashboardCard
            title="Sottoscorta"
            value={stats.lowStock}
            subtitle="Calcolo leggero locale"
          />
          <DashboardCard
            title="Notifiche"
            value={stats.notificationsCount}
            subtitle="Avvisi disponibili"
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-orange-500/20 bg-zinc-950/80 p-5 shadow-xl shadow-black/20 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Movimenti recenti</h2>
                <p className="text-sm text-zinc-400">
                  Solo ultimi 12 movimenti: nessuna query globale.
                </p>
              </div>
              <div className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                {recentMovements.length} caricati
              </div>
            </div>

            {recentMovements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
                Nessun movimento recente ancora caricato.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-xs uppercase tracking-[0.15em] text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Materiale</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3 text-right">Q.tà</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {recentMovements.map((item, index) => (
                      <tr key={item?.id ?? index} className="bg-black/20">
                        <td className="px-4 py-3 text-zinc-400">
                          {getMovementDate(item)
                            ? new Date(getMovementDate(item)).toLocaleDateString('it-IT')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {getMaterialName(item)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isExitMovement(item)
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {isExitMovement(item) ? 'Uscita' : 'Entrata'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {getQty(item)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-orange-500/20 bg-zinc-950/80 p-5 shadow-xl shadow-black/20">
              <h2 className="text-xl font-bold">Riepilogo rapido</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Entrate recenti</span>
                  <strong>{stats.entries}</strong>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Uscite recenti</span>
                  <strong>{stats.exits}</strong>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-zinc-400">Utenti</span>
                  <strong>{usersCount ?? '...'}</strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-500/20 bg-zinc-950/80 p-5 shadow-xl shadow-black/20">
              <h2 className="text-xl font-bold">Memoria Supabase</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Controllo disattivato all’avvio per non rallentare la dashboard.
              </p>

              {usage ? (
                <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-black p-4 text-xs text-zinc-300">
                  {JSON.stringify(usage, null, 2)}
                </pre>
              ) : (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-4 text-sm text-zinc-500">
                  Premi il bottone in alto per controllarla manualmente.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
