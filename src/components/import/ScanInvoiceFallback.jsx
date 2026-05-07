import React from 'react';

function createEmptyRow() {
  return {
    code: '',
    description: '',
    unit: 'PZ',
    quantity: 1,
    price: 0,
    supplier: '',
  };
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
}) {
  const validRowsCount = (rows || []).filter((row) => {
    const hasCode = String(row.code || '').trim().length > 0;
    const hasDescription = String(row.description || '').trim().length > 0;
    const hasSupplier = String(row.supplier || '').trim().length > 0;
    const quantity = Number(row.quantity || 0);

    return hasCode && hasDescription && hasSupplier && quantity > 0;
  }).length;

  const isValid = validRowsCount > 0;

  return (
    <div className="card animate-fadeIn">
      <div className="card-header" style={{ background: 'var(--warning-50)' }}>
        <h3 className="card-title">🖼️ Compilazione guidata da scansione</h3>
        <p className="text-sm mt-1">
          Il file <strong>{fileName}</strong> è una scansione. Inserisci manualmente le righe prodotto leggendo la fattura e poi continua con l’importazione.
        </p>
      </div>

      <div className="card-body" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Codice</th>
              <th>Descrizione</th>
              <th style={{ width: 100 }}>UM</th>
              <th style={{ width: 120 }}>Quantità</th>
              <th style={{ width: 130 }}>Prezzo Netto</th>
              <th style={{ width: 190 }}>Fornitore *</th>
              <th style={{ width: 130 }}>Listino +22%</th>
              {showInstallerPrice && <th style={{ width: 160 }}>Installatore -10% +22%</th>}
              <th style={{ width: 130 }}>Totale Netto</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>

          <tbody>
            {(rows || []).map((row, index) => {
              const quantity = Number(row.quantity || 0);
              const price = Number(row.price || 0);
              const total = quantity * price;

              return (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.code}
                      onChange={(e) => onChangeRow(index, 'code', e.target.value)}
                      placeholder="Codice"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.description}
                      onChange={(e) => onChangeRow(index, 'description', e.target.value)}
                      placeholder="Descrizione materiale"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.unit}
                      onChange={(e) => onChangeRow(index, 'unit', e.target.value.toUpperCase())}
                      placeholder="PZ"
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={row.quantity}
                      onChange={(e) => onChangeRow(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={row.price}
                      onChange={(e) => onChangeRow(index, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={row.supplier || ''}
                      onChange={(e) => onChangeRow(index, 'supplier', e.target.value)}
                      placeholder="Nome fornitore"
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
