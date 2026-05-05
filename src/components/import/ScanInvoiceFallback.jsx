import { useMemo } from 'react';

export function createEmptyRow() {
  return {
    code: '',
    description: '',
    quantity: 1,
    unit: 'ST',
    price: 0,
    brand: '',
    category: '',
    location: 'A1-01',
  };
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ScanInvoiceFallback({
  fileName = '',
  rows = [],
  onChangeRow,
  onAddRow,
  onRemoveRow,
  onCancel,
  onContinue,
}) {
  const validRows = useMemo(() => {
    return (rows || []).filter((row) => {
      const code = String(row.code || '').trim();
      const description = String(row.description || '').trim();
      const quantity = parseNumber(row.quantity);

      return code && description && quantity > 0;
    });
  }, [rows]);

  const totalQuantity = useMemo(() => {
    return validRows.reduce((sum, row) => sum + parseNumber(row.quantity), 0);
  }, [validRows]);

  const totalValue = useMemo(() => {
    return validRows.reduce(
      (sum, row) => sum + parseNumber(row.quantity) * parseNumber(row.price),
      0
    );
  }, [validRows]);

  return (
    <div className="card animate-fadeIn">
      <div
        className="card-header"
        style={{
          background: 'var(--warning-50)',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div>
          <h3 className="card-title">✍️ Inserimento guidato componenti</h3>
          <p className="card-subtitle">
            {fileName
              ? `Documento: ${fileName}`
              : 'Compila manualmente le righe da caricare in magazzino'}
          </p>
        </div>

        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel}>
            Annulla
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onAddRow}>
            + Aggiungi riga
          </button>
        </div>
      </div>

      <div className="card-body">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div className="kpi-card" style={{ minHeight: 86, padding: 14 }}>
            <div className="kpi-icon blue">📄</div>
            <div className="kpi-content">
              <div className="kpi-label">Righe valide</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                {validRows.length}
              </div>
              <div className="kpi-detail">complete e importabili</div>
            </div>
          </div>

          <div className="kpi-card" style={{ minHeight: 86, padding: 14 }}>
            <div className="kpi-icon green">📦</div>
            <div className="kpi-content">
              <div className="kpi-label">Quantità totale</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                {totalQuantity}
              </div>
              <div className="kpi-detail">pezzi / unità</div>
            </div>
          </div>

          <div className="kpi-card" style={{ minHeight: 86, padding: 14 }}>
            <div className="kpi-icon purple">€</div>
            <div className="kpi-content">
              <div className="kpi-label">Valore stimato</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                € {totalValue.toFixed(2)}
              </div>
              <div className="kpi-detail">quantità × prezzo netto</div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--primary-50)',
            border: '1px solid var(--primary-100)',
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, color: 'var(--primary-700)', marginBottom: 4 }}>
            Come funziona
          </div>
          <div className="text-sm" style={{ color: 'var(--gray-700)' }}>
            Inserisci codice, descrizione e quantità. Dopo aver premuto “Continua” andrai
            nell’anteprima, dove potrai correggere categoria, marca, prezzo e posizione prima del
            salvataggio definitivo.
          </div>
        </div>

        <div className="table-container">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>Codice *</th>
                <th>Descrizione *</th>
                <th>Qtà *</th>
                <th>UM</th>
                <th>Prezzo Netto</th>
                <th>Marca</th>
                <th>Categoria testo</th>
                <th>Posizione</th>
                <th style={{ width: 80 }}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {(rows || []).map((row, index) => {
                const codeMissing = !String(row.code || '').trim();
                const descriptionMissing = !String(row.description || '').trim();
                const quantityInvalid = parseNumber(row.quantity) <= 0;

                return (
                  <tr key={index}>
                    <td style={{ fontWeight: 900 }}>{index + 1}</td>

                    <td>
                      <input
                        className="form-control"
                        value={row.code || ''}
                        onChange={(e) => onChangeRow(index, 'code', e.target.value)}
                        placeholder="Es. 8-738-722-157"
                        style={{
                          minWidth: 150,
                          borderColor: codeMissing
                            ? 'var(--warning-400)'
                            : 'var(--gray-300)',
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control"
                        value={row.description || ''}
                        onChange={(e) => onChangeRow(index, 'description', e.target.value)}
                        placeholder="Descrizione componente"
                        style={{
                          minWidth: 260,
                          borderColor: descriptionMissing
                            ? 'var(--warning-400)'
                            : 'var(--gray-300)',
                        }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control"
                        value={row.quantity ?? 1}
                        onChange={(e) => onChangeRow(index, 'quantity', e.target.value)}
                        style={{
                          width: 90,
                          borderColor: quantityInvalid
                            ? 'var(--warning-400)'
                            : 'var(--gray-300)',
                        }}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control"
                        value={row.unit || 'ST'}
                        onChange={(e) => onChangeRow(index, 'unit', e.target.value)}
                        style={{ width: 80 }}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control"
                        value={row.price ?? 0}
                        onChange={(e) => onChangeRow(index, 'price', e.target.value)}
                        style={{ width: 120 }}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control"
                        value={row.brand || ''}
                        onChange={(e) => onChangeRow(index, 'brand', e.target.value)}
                        placeholder="Es. Bosch"
                        style={{ minWidth: 130 }}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control"
                        value={row.category || ''}
                        onChange={(e) => onChangeRow(index, 'category', e.target.value)}
                        placeholder="Es. ricambi"
                        style={{ minWidth: 140 }}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control"
                        value={row.location || 'A1-01'}
                        onChange={(e) => onChangeRow(index, 'location', e.target.value)}
                        style={{ width: 110 }}
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost text-danger"
                        onClick={() => onRemoveRow(index)}
                        disabled={(rows || []).length <= 1}
                        title="Elimina riga"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}

              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan="10" style={{ padding: 32 }}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📄</div>
                      <div className="empty-state-title">Nessuna riga presente</div>
                      <div className="empty-state-text">
                        Aggiungi una riga per continuare con l’importazione.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="card-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div className="text-sm text-muted">
          Campi obbligatori: <strong>codice</strong>, <strong>descrizione</strong>,{' '}
          <strong>quantità maggiore di zero</strong>.
        </div>

        <div className="btn-group">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            ← Annulla
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            disabled={validRows.length === 0}
          >
            Continua all’anteprima →
          </button>
        </div>
      </div>
    </div>
  );
}