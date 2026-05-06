// ============================================================
// BACKUPSISTEMA.JSX - Backup manuale scaricabile dal sito
// ============================================================

import { useState } from 'react';
import { supabase } from '../../supabaseClient';

const TABLES = [
  'categorie',
  'materiali',
  'movimenti',
  'notifiche',
  'log_modifiche',
  'fatture_importate',
  'impostazioni',
  'proposte_ordine',
  'righe_proposta_ordine',
  'sessioni_inventario',
  'righe_inventario',
  'utenti',
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function getTimestamp() {
  const now = new Date();

  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-');

  const time = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');

  return `${date}_${time}`;
}

function downloadJson(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function readAllRows(tableName) {
  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to);

    if (error) {
      throw new Error(`${tableName}: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;

    from += pageSize;
  }

  return allRows;
}

export default function BackupSistema() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: TABLES.length });

  const runBackup = async () => {
    setLoading(true);
    setError('');
    setLastBackup(null);
    setProgress({ current: 0, total: TABLES.length });

    const startedAt = new Date();

    const backup = {
      app: 'MagazzinoPro',
      type: 'browser-manual-backup',
      version: 1,
      createdAt: startedAt.toISOString(),
      completedAt: null,
      tables: {},
      manifest: {
        tables: [],
        errors: [],
      },
    };

    try {
      for (let index = 0; index < TABLES.length; index += 1) {
        const tableName = TABLES[index];

        setProgress({ current: index + 1, total: TABLES.length });

        try {
          const rows = await readAllRows(tableName);

          backup.tables[tableName] = rows;
          backup.manifest.tables.push({
            table: tableName,
            rows: rows.length,
            status: 'ok',
          });
        } catch (tableError) {
          const message = tableError?.message || String(tableError);

          backup.tables[tableName] = [];
          backup.manifest.tables.push({
            table: tableName,
            rows: 0,
            status: 'error',
            error: message,
          });
          backup.manifest.errors.push({
            table: tableName,
            error: message,
          });
        }
      }

      backup.completedAt = new Date().toISOString();

      const fileName = `magazzino-pro-backup-${getTimestamp()}.json`;
      downloadJson(fileName, backup);

      setLastBackup({
        fileName,
        createdAt: backup.completedAt,
        totalTables: backup.manifest.tables.length,
        errors: backup.manifest.errors,
        tables: backup.manifest.tables,
      });
    } catch (err) {
      setError(err?.message || 'Errore durante la creazione del backup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">💾 Backup Sistema</h1>
          <p className="page-subtitle">
            Scarica una copia completa dei dati del magazzino direttamente dal sito.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Backup manuale</h3>
        </div>

        <div className="card-body">
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Il backup include materiali, categorie, movimenti, notifiche, log,
            archivio fatture, utenti e sessioni inventario. Verrà scaricato un file
            JSON sul tuo computer.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={runBackup}
            disabled={loading}
          >
            {loading
              ? `Creazione backup... ${progress.current}/${progress.total}`
              : '⬇️ Scarica backup completo'}
          </button>

          {loading && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  width: '100%',
                  height: 10,
                  background: 'var(--gray-200)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    height: '100%',
                    background: 'var(--primary-600)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 8 }}>
                Esportazione tabelle in corso...
              </div>
            </div>
          )}

          {error && (
            <div className="login-error" style={{ marginTop: 18 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {lastBackup && (
        <div className="card animate-fadeIn">
          <div className="card-header" style={{ background: 'var(--success-50)' }}>
            <h3 className="card-title">✅ Backup scaricato</h3>
          </div>

          <div className="card-body">
            <div style={{ marginBottom: 14 }}>
              <strong>File:</strong> {lastBackup.fileName}
            </div>

            <div style={{ marginBottom: 14 }}>
              <strong>Data:</strong>{' '}
              {new Date(lastBackup.createdAt).toLocaleString('it-IT')}
            </div>

            {lastBackup.errors.length > 0 ? (
              <div className="login-error" style={{ marginBottom: 16 }}>
                Alcune tabelle non sono state esportate. Controlla il dettaglio sotto.
              </div>
            ) : (
              <div
                style={{
                  padding: 14,
                  borderRadius: 'var(--border-radius-md)',
                  background: 'var(--success-50)',
                  color: 'var(--success-700)',
                  fontWeight: 800,
                  marginBottom: 16,
                }}
              >
                Tutte le tabelle sono state esportate correttamente.
              </div>
            )}

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tabella</th>
                    <th>Righe</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {lastBackup.tables.map((item) => (
                    <tr key={item.table}>
                      <td style={{ fontWeight: 800 }}>{item.table}</td>
                      <td>{item.rows}</td>
                      <td>
                        {item.status === 'ok' ? (
                          <span style={{ color: 'var(--success-700)', fontWeight: 800 }}>
                            OK
                          </span>
                        ) : (
                          <span style={{ color: 'var(--danger-700)', fontWeight: 800 }}>
                            Errore: {item.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-body">
          <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
            Dove conservare il file
          </h3>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Salva il file backup in una cartella sicura, per esempio su disco esterno
            o Drive privato aziendale. Non inviarlo a persone esterne: contiene dati
            del magazzino e degli utenti.
          </p>
        </div>
      </div>
    </div>
  );
}
