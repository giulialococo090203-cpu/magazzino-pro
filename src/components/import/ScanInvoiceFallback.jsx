import React from 'react';

const UNIT_OPTIONS = [
  'PZ',
  'NR',
  'MT',
  'M',
  'KG',
  'GR',
  'LT',
  'L',
  'ML',
  'CF',
  'CONF',
  'SC',
  'SCAT',
  'ROT',
  'SAC',
  'BOB',
  'KIT',
];

function createEmptyRow() {
  return {
    code: '',
    description: '',
    unit: 'PZ',
    quantity: '',
    price: '',
    supplier: '',
  };
}

function parseDecimal(value = 0) {
  return Number(String(value || '0').replace(',', '.')) || 0;
}

function formatCurrency(value = 0) {
  return Number(value || 0).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

function getListPrice(value = 0) {
  return Number(value || 0) * 1.22;
}

function getInstallerPrice(value = 0) {
  return Number(value || 0) * 0.9 * 1.22;
}

export default function ScanInvoiceFallback({
  fileName,
  rows,
  showInstallerPrice = false,
  onChangeRow,
  onAddRow,
  onRemoveRow,
  onCancel,
  onContinue,
  supplierSuggestions = [],
}) {
  const validRowsCount = (rows || []).filter((row) => {
    const hasCode = String(row.code || '').trim().length > 0;
    const hasDescription = String(row.description || '').trim().length > 0;
    const hasSupplier = String(row.supplier || '').trim().length > 0;
    const quantity = parseDecimal(row.quantity);

    return hasCode && hasDescription && hasSupplier && quantity > 0;
  }).length;

  const isValid = validRowsCount > 0;

  return (
    <div className="card animate-fadeIn">
      <div className="card-header" style={{ background: 'var(--warning-50)' }}>
        <h3 className="card-title">✍️ Inserimento manuale componenti</h3>
        <p className="text-sm mt-1">
          Inserisci manualmente i componenti. Il fornitore è obbligatorio per collegare il carico alla sezione Fornitori.
        </p>
      </div>

      <div className="card-body" style={{ overflowX: 'auto' }}>
        <datalist id="manual-supplier-suggestions">
          {(supplierSuggestions || []).map((supplier) => (
            <option key={supplier} value={supplier} />
          ))}
        </datalist>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Codice</th>
              <th>Descrizione</th>
              <th style={{ width: 110 }}>UM</th>
              <th style={{ width: 120 }}>Quantità</th>
              <th style={{ width: 140 }}>Prezzo netto</th>
              <th style={{ width: 190 }}>Fornitore *</th>
              <th style={{ width: 130 }}>Listino +22%</th>
              {showInstallerPrice && <th style={{ width: 160 }}>Installatore -10% +22%</th>}
              <th style={{ width: 130 }}>Totale netto</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>

          <tbody>
            {(rows || []).map((row, index) => {
              const quantity = parseDecimal(row.quantity);
              const price = parseDecimal(row.price);
              const total = quantity * price;

              return (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.code || ''}
                      onChange={(e) => onChangeRow(index, 'code', e.target.value)}
                      placeholder="Codice"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.description || ''}
                      onChange={(e) => onChangeRow(index, 'description', e.target.value)}
                      placeholder="Descrizione materiale"
                      style={{ minWidth: 260 }}
                    />
                  </td>

                  <td>
                    <select
                      className="form-control"
                      value={row.unit || 'PZ'}
                      onChange={(e) => onChangeRow(index, 'unit', e.target.value)}
                    >
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      value={row.quantity ?? ''}
                      onChange={(e) => onChangeRow(index, 'quantity', e.target.value)}
                      placeholder="Es. 1"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-control"
                      value={row.price ?? ''}
                      onChange={(e) => onChangeRow(index, 'price', e.target.value)}
                      placeholder="Es. 10,50"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.supplier || ''}
                      onChange={(e) => onChangeRow(index, 'supplier', e.target.value)}
                      placeholder="Nome fornitore"
                      list="manual-supplier-suggestions"
                      autoComplete="off"
                      style={{
                        minWidth: 180,
                        borderColor: String(row.supplier || '').trim()
                          ? undefined
                          : 'var(--warning-400)',
                      }}
                    />
                  </td>

                  <td>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {formatCurrency(getListPrice(price))}
                    </div>
                  </td>

                  {showInstallerPrice && (
                    <td>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', color: 'var(--primary-700)' }}>
                        {formatCurrency(getInstallerPrice(price))}
                      </div>
                    </td>
                  )}

                  <td>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {formatCurrency(Number.isFinite(total) ? total : 0)}
                    </div>
                  </td>

                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => onRemoveRow(index)}
                      disabled={(rows || []).length <= 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onAddRow}>
            + Aggiungi riga
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 'var(--border-radius-md)',
            background: 'var(--gray-50)',
            color: 'var(--gray-700)',
            fontSize: 14,
          }}
        >
          <strong>Righe valide inserite:</strong> {validRowsCount}
          <div style={{ marginTop: 6 }}>
            Compila almeno <strong>codice</strong>, <strong>descrizione</strong>, <strong>quantità</strong> e <strong>fornitore</strong>.
          </div>
        </div>
      </div>

      <div
        className="card-footer"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <button className="btn btn-secondary" onClick={onCancel}>
          ← Annulla
        </button>

        <button className="btn btn-primary" onClick={onContinue} disabled={!isValid}>
          Continua con l’importazione →
        </button>
      </div>
    </div>
  );
}

export { createEmptyRow };
