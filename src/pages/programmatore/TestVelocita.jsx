import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  getCurrentCompanyId,
  svuotaMemoriaLetture,
  materialStore,
  categoryStore,
  movementStore,
  notificationStore,
  adminLogStore,
  invoiceImportStore,
  reorderProposalStore,
  physicalInventoryStore,
  userStore,
  statsStore,
} from '../../data/store';

/*
 * Test di velocità: esegue SOLO letture, una alla volta, e mostra quanto
 * impiega ogni funzione dell'app. Non modifica nessun dato.
 */

const OGGI = () => new Date().toISOString().slice(0, 10);
const GIORNI_FA = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const contaRighe = (r) => {
  if (Array.isArray(r)) return r.length;
  if (r && Array.isArray(r.rows)) return r.total ?? r.rows.length;
  if (r && typeof r === 'object' && 'totalMaterials' in r) return r.totalMaterials;
  return null;
};

const TEST = [
  { id: 'mat-tutti', pagina: 'Ordini · Dashboard', nome: 'Tutti i materiali', fn: () => materialStore.getAll() },
  { id: 'mat-pagina', pagina: 'Giacenza', nome: 'Prima pagina giacenza (200)', fn: () => materialStore.getPage({ limit: 200 }) },
  { id: 'mat-cerca', pagina: 'Giacenza', nome: 'Ricerca "valvola"', fn: () => materialStore.getPage({ search: 'valvola', limit: 200 }) },
  { id: 'mat-codice', pagina: 'Giacenza', nome: 'Ricerca per codice', fn: () => materialStore.getPage({ search: 'TEST-0123', limit: 200 }) },
  { id: 'mat-soglia', pagina: 'Giacenza', nome: 'Filtro sotto soglia', fn: () => materialStore.getPage({ status: 'sotto_soglia', limit: 200 }) },
  { id: 'mat-pag10', pagina: 'Giacenza', nome: 'Scorrimento (pagina 50)', fn: () => materialStore.getPage({ limit: 200, offset: 10000 }) },
  { id: 'ordini', pagina: 'Ordini da ordinare', nome: 'Materiali sotto soglia', fn: () => reorderProposalStore.getUnderThresholdMaterials() },
  { id: 'proposte', pagina: 'Archivio ordini', nome: 'Elenco proposte d’ordine', fn: () => reorderProposalStore.getPage({ limit: 200 }) },
  { id: 'mov-recenti', pagina: 'Storico movimenti', nome: 'Ultimi 120 movimenti', fn: () => movementStore.getRecent(120) },
  { id: 'mov-filtro', pagina: 'Storico movimenti', nome: 'Filtro 3 mesi (max 500)', fn: () => movementStore.getFiltered({ dateFrom: GIORNI_FA(90), dateTo: OGGI(), limit: 500 }) },
  { id: 'mov-form', pagina: 'Carico / Scarico', nome: 'Movimenti recenti modulo', fn: () => movementStore.getRecent(500) },
  { id: 'mov-30', pagina: 'Dashboard', nome: 'Movimenti ultimi 30 giorni', fn: () => movementStore.getFiltered({ dateFrom: GIORNI_FA(30), dateTo: OGGI() }) },
  { id: 'dashboard', pagina: 'Dashboard', nome: 'Riepilogo dashboard', fn: () => statsStore.getDashboardStats() },
  { id: 'piu-mossi', pagina: 'Dashboard controllo', nome: 'Materiali più movimentati', fn: () => movementStore.getMostMoved(8, 30) },
  { id: 'entrate-uscite', pagina: 'Dashboard controllo', nome: 'Entrate e uscite 30 giorni', fn: () => movementStore.getEntriesVsExits(30) },
  { id: 'rendiconto', pagina: 'Rendicontazione', nome: 'Movimenti del mese (700)', fn: () => movementStore.getFiltered({ dateFrom: GIORNI_FA(30), dateTo: OGGI(), limit: 700 }) },
  { id: 'fornitori', pagina: 'Fornitori', nome: 'Ultimi 250 movimenti', fn: () => movementStore.getRecent(250) },
  { id: 'categorie', pagina: 'Categorie', nome: 'Elenco categorie', fn: () => categoryStore.getAll() },
  { id: 'notifiche', pagina: 'Notifiche', nome: 'Tutte le notifiche', fn: () => notificationStore.getAll() },
  { id: 'registro', pagina: 'Registro modifiche', nome: 'Ultime 500 modifiche', fn: () => adminLogStore.getAll(500) },
  { id: 'fatture', pagina: 'Fatture', nome: 'Elenco fatture', fn: () => invoiceImportStore.getPage({ limit: 200 }) },
  { id: 'inventario', pagina: 'Inventario fisico', nome: 'Sessioni di inventario', fn: () => physicalInventoryStore.getAllSessions(100) },
  { id: 'utenti', pagina: 'Utenti', nome: 'Elenco utenti', fn: () => userStore.getAll() },
];

const TABELLE = [
  { tabella: 'materiali', label: 'Materiali' },
  { tabella: 'movimenti', label: 'Movimenti' },
  { tabella: 'notifiche', label: 'Notifiche' },
  { tabella: 'log_modifiche', label: 'Registro' },
  { tabella: 'categorie', label: 'Categorie' },
];

function giudizio(ms) {
  if (ms == null) return { testo: '—', classe: '' };
  if (ms < 800) return { testo: 'Rapido', classe: 'tv-ok' };
  if (ms < 2500) return { testo: 'Accettabile', classe: 'tv-medio' };
  return { testo: 'Lento', classe: 'tv-lento' };
}

const formatMs = (ms) =>
  ms == null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2).replace('.', ',')} s`;

export default function TestVelocita() {
  const [conteggi, setConteggi] = useState(null);
  const [risultati, setRisultati] = useState({});
  const [inCorso, setInCorso] = useState(false);
  const [corrente, setCorrente] = useState('');
  const [totale, setTotale] = useState(null);
  const stop = useRef(false);

  const caricaConteggi = useCallback(async () => {
    const azienda = getCurrentCompanyId();
    const valori = await Promise.all(
      TABELLE.map(async ({ tabella }) => {
        const { count, error } = await supabase
          .from(tabella)
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', azienda);
        return error ? null : count;
      })
    );
    setConteggi(Object.fromEntries(TABELLE.map((t, i) => [t.tabella, valori[i]])));
  }, []);

  useEffect(() => {
    caricaConteggi().catch(() => setConteggi({}));
    return () => {
      stop.current = true;
    };
  }, [caricaConteggi]);

  const avvia = async () => {
    stop.current = false;
    setInCorso(true);
    setRisultati({});
    setTotale(null);
    const inizioTotale = performance.now();

    for (const test of TEST) {
      if (stop.current) break;
      setCorrente(test.id);

      // Prima lettura: come chi apre la pagina per la prima volta.
      svuotaMemoriaLetture();
      let ms = null;
      let righe = null;
      let errore = '';
      try {
        const t0 = performance.now();
        const r = await test.fn();
        ms = performance.now() - t0;
        righe = contaRighe(r);
      } catch (err) {
        errore = err?.message || String(err);
      }

      // Seconda lettura: tornando sulla pagina (memoria dell'app).
      let msMemoria = null;
      if (!errore) {
        try {
          const t1 = performance.now();
          await test.fn();
          msMemoria = performance.now() - t1;
        } catch {
          /* la seconda lettura serve solo per il confronto */
        }
      }

      setRisultati((prev) => ({ ...prev, [test.id]: { ms, msMemoria, righe, errore } }));
    }

    setTotale(performance.now() - inizioTotale);
    setCorrente('');
    setInCorso(false);
    svuotaMemoriaLetture();
  };

  const valori = Object.values(risultati).filter((r) => r.ms != null);
  const massimo = Math.max(1000, ...valori.map((r) => r.ms));
  const lenti = valori.filter((r) => r.ms >= 2500).length;
  const errori = Object.values(risultati).filter((r) => r.errore).length;
  const media = valori.length ? valori.reduce((s, r) => s + r.ms, 0) / valori.length : null;

  return (
    <div className="prog-section tv">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Dati presenti nel database</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={caricaConteggi} disabled={inCorso}>
            Aggiorna
          </button>
        </div>
        <div className="card-body">
          <div className="tv-conteggi">
            {TABELLE.map(({ tabella, label }) => (
              <div key={tabella} className="tv-conteggio">
                <span className="tv-conteggio-label">{label}</span>
                <span className="tv-conteggio-valore">
                  {conteggi == null ? '…' : conteggi[tabella] == null ? '—' : Number(conteggi[tabella]).toLocaleString('it-IT')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Test di velocità</h2>
            <p className="text-muted text-sm" style={{ margin: '2px 0 0' }}>
              Solo letture, nessun dato viene modificato. Ogni funzione è misurata due volte:
              alla prima apertura e tornando sulla pagina.
            </p>
          </div>
          {inCorso ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => (stop.current = true)}>
              Interrompi
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={avvia}>
              {valori.length ? 'Ripeti il test' : 'Avvia il test'}
            </button>
          )}
        </div>

        <div className="card-body">
          {(totale != null || inCorso) && (
            <div className="tv-riepilogo">
              <div><span>Funzioni provate</span><strong>{Object.keys(risultati).length} / {TEST.length}</strong></div>
              <div><span>Tempo medio</span><strong>{formatMs(media)}</strong></div>
              <div><span>Lente</span><strong className={lenti ? 'tv-lento' : 'tv-ok'}>{lenti}</strong></div>
              <div><span>Errori</span><strong className={errori ? 'tv-lento' : 'tv-ok'}>{errori}</strong></div>
              <div><span>Durata totale</span><strong>{totale != null ? formatMs(totale) : 'in corso…'}</strong></div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table tv-tabella">
              <thead>
                <tr>
                  <th>Funzione</th>
                  <th>Pagina</th>
                  <th style={{ width: '32%' }}>Prima apertura</th>
                  <th>Tornando</th>
                  <th style={{ textAlign: 'right' }}>Righe</th>
                  <th>Esito</th>
                </tr>
              </thead>
              <tbody>
                {TEST.map((test) => {
                  const r = risultati[test.id];
                  const g = giudizio(r?.ms);
                  const attivo = corrente === test.id;
                  return (
                    <tr key={test.id} className={attivo ? 'tv-attivo' : ''}>
                      <td className="cella-nome">{test.nome}</td>
                      <td className="text-muted">{test.pagina}</td>
                      <td>
                        <div className="tv-barra-riga">
                          <div className="tv-barra">
                            {attivo && <div className="tv-barra-attesa" />}
                            {r?.ms != null && (
                              <div className={`tv-barra-piena ${g.classe}`} style={{ width: `${Math.max(2, (r.ms / massimo) * 100)}%` }} />
                            )}
                          </div>
                          <span className="tv-ms">{attivo ? '…' : formatMs(r?.ms)}</span>
                        </div>
                      </td>
                      <td className="tv-ms">{formatMs(r?.msMemoria)}</td>
                      <td style={{ textAlign: 'right' }}>{r?.righe == null ? '—' : Number(r.righe).toLocaleString('it-IT')}</td>
                      <td>
                        {r?.errore ? (
                          <span className="badge badge-danger" title={r.errore}>Errore</span>
                        ) : r ? (
                          <span className={`tv-esito ${g.classe}`}>{g.testo}</span>
                        ) : attivo ? (
                          <span className="text-muted">in prova…</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-muted text-sm" style={{ marginTop: 12 }}>
            Rapido sotto 0,8 s · Accettabile fino a 2,5 s · Lento oltre. I tempi dipendono anche dalla connessione.
          </p>
        </div>
      </div>
    </div>
  );
}
