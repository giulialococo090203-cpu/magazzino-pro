import { useMemo, useState } from 'react';
import { generaPdfOrdine } from '../../utils/ordinePdf';
import { AZIENDA_NOME } from '../../config/azienda';
import { reorderProposalStore } from '../../data/store';
import Icon from '../../components/Icon';

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function oggi() {
  return new Date().toISOString().slice(0, 10);
}

function fraGiorni(giorni) {
  const data = new Date();
  data.setDate(data.getDate() + giorni);
  return data.toISOString().slice(0, 10);
}

function numeroOrdineIniziale() {
  const adesso = new Date();
  const anno = adesso.getFullYear();
  const progressivo = String(Date.now()).slice(-4);

  return `ORD-${anno}-${progressivo}`;
}

function formatData(valore) {
  if (!valore) return '—';

  const data = new Date(valore);

  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('it-IT');
}

const CONDIZIONI_PAGAMENTO = [
  'Bonifico bancario 30 giorni data fattura',
  'Bonifico bancario 60 giorni data fattura',
  'Bonifico bancario 30/60 giorni',
  'Rimessa diretta',
  'Ricevuta bancaria 30 giorni',
  'Pagamento anticipato',
];

const MODALITA_SPEDIZIONE = [
  'Corriere espresso',
  'Corriere standard',
  'Ritiro presso fornitore',
  'Consegna diretta del fornitore',
];

const PORTO = ['Franco destino', 'Franco fabbrica', 'Porto assegnato'];

function creaRiga(materiale, quantita) {
  return {
    idRiga: `${materiale.id || 'libera'}-${Math.random().toString(36).slice(2, 8)}`,
    materialId: materiale.id || null,
    incluso: true,
    codice: materiale.code || '',
    descrizione: materiale.description || '',
    marca: materiale.brand || '',
    categoria: materiale.category || null,
    unita: materiale.unit || 'pz',
    quantitaAttuale: Number(materiale.quantity || 0),
    sogliaMinima: Number(materiale.minThreshold || 0),
    posizione: materiale.location || '',
    fornitore: materiale.supplier || '',
    quantita: Number(quantita ?? materiale.suggestedQty ?? 1) || 1,
    prezzo: Number(materiale.netPrice ?? materiale.purchasePrice ?? 0) || 0,
    sconto: 0,
    note: '',
  };
}

export default function ComposizioneOrdine({
  righeIniziali = [],
  materiali = [],
  fornitorePredefinito = '',
  user,
  onChiudi,
  onSalvato,
}) {
  const [testata, setTestata] = useState({
    numero: numeroOrdineIniziale(),
    data: oggi(),
    consegnaRichiesta: fraGiorni(7),
    riferimentoInterno: user?.fullName || user?.username || '',

    fornitore: fornitorePredefinito || righeIniziali[0]?.supplier || '',
    fornitoreReferente: '',
    fornitoreEmail: '',
    fornitoreTelefono: '',
    fornitoreIndirizzo: '',

    destinatario: AZIENDA_NOME,
    indirizzoConsegna: '',
    referenteConsegna: '',
    telefonoConsegna: '',
    orariConsegna: '',

    pagamento: CONDIZIONI_PAGAMENTO[0],
    spedizione: MODALITA_SPEDIZIONE[0],
    porto: PORTO[0],

    iva: 22,
    scontoGenerale: 0,
    speseTrasporto: 0,

    note: '',
  });

  const [righe, setRighe] = useState(() =>
    righeIniziali.map((materiale) => creaRiga(materiale, materiale.suggestedQty))
  );

  const [ricercaAggiunta, setRicercaAggiunta] = useState('');
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  const [errore, setErrore] = useState('');

  const aggiornaTestata = (campo, valore) =>
    setTestata((precedente) => ({ ...precedente, [campo]: valore }));

  const aggiornaRiga = (idRiga, campo, valore) =>
    setRighe((precedenti) =>
      precedenti.map((riga) => (riga.idRiga === idRiga ? { ...riga, [campo]: valore } : riga))
    );

  const rimuoviRiga = (idRiga) =>
    setRighe((precedenti) => precedenti.filter((riga) => riga.idRiga !== idRiga));

  const righeIncluse = useMemo(
    () => righe.filter((riga) => riga.incluso && Number(riga.quantita) > 0),
    [righe]
  );

  const totaleRiga = (riga) => {
    const lordo = Number(riga.quantita || 0) * Number(riga.prezzo || 0);
    return lordo * (1 - Number(riga.sconto || 0) / 100);
  };

  const totali = useMemo(() => {
    const imponibileLordo = righeIncluse.reduce((somma, riga) => somma + totaleRiga(riga), 0);
    const scontoGenerale = imponibileLordo * (Number(testata.scontoGenerale || 0) / 100);
    const trasporto = Number(testata.speseTrasporto || 0);
    const imponibile = imponibileLordo - scontoGenerale + trasporto;
    const iva = imponibile * (Number(testata.iva || 0) / 100);

    return {
      imponibileLordo,
      scontoGenerale,
      trasporto,
      imponibile,
      iva,
      totale: imponibile + iva,
    };
  }, [righeIncluse, testata.scontoGenerale, testata.speseTrasporto, testata.iva]);

  const suggerimenti = useMemo(() => {
    const q = ricercaAggiunta.trim().toLowerCase();

    if (q.length < 2) return [];

    const giaPresenti = new Set(righe.map((riga) => riga.materialId).filter(Boolean));

    return materiali
      .filter((materiale) => !giaPresenti.has(materiale.id))
      .filter(
        (materiale) =>
          String(materiale.code || '').toLowerCase().includes(q) ||
          String(materiale.description || '').toLowerCase().includes(q) ||
          String(materiale.brand || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [ricercaAggiunta, materiali, righe]);

  const aggiungiMateriale = (materiale) => {
    setRighe((precedenti) => [...precedenti, creaRiga(materiale, 1)]);
    setRicercaAggiunta('');
  };

  const aggiungiRigaLibera = () => {
    setRighe((precedenti) => [
      ...precedenti,
      creaRiga({ id: null, description: '', code: '', unit: 'pz' }, 1),
    ]);
  };

  // ----------------------------------------------------------
  // Salvataggio come proposta d'ordine
  // ----------------------------------------------------------

  const salvaProposta = async () => {
    if (righeIncluse.length === 0) {
      setErrore('Seleziona almeno un materiale da ordinare.');
      return;
    }

    const riepilogo = [
      `Ordine ${testata.numero} del ${formatData(testata.data)}`,
      `Fornitore: ${testata.fornitore || '—'}`,
      testata.fornitoreReferente ? `Referente fornitore: ${testata.fornitoreReferente}` : '',
      testata.fornitoreEmail ? `Email: ${testata.fornitoreEmail}` : '',
      testata.fornitoreTelefono ? `Telefono: ${testata.fornitoreTelefono}` : '',
      `Consegna richiesta: ${formatData(testata.consegnaRichiesta)}`,
      testata.indirizzoConsegna ? `Indirizzo consegna: ${testata.indirizzoConsegna}` : '',
      testata.referenteConsegna ? `Referente consegna: ${testata.referenteConsegna}` : '',
      testata.orariConsegna ? `Orari: ${testata.orariConsegna}` : '',
      `Pagamento: ${testata.pagamento}`,
      `Spedizione: ${testata.spedizione} · ${testata.porto}`,
      `Riferimento interno: ${testata.riferimentoInterno || '—'}`,
      `Totale ordine: ${formatCurrency(totali.totale)} (IVA ${testata.iva}%)`,
      testata.note ? `Note: ${testata.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      setSalvataggio(true);
      setErrore('');

      await reorderProposalStore.createFromMaterials({
        materials: righeIncluse.map((riga) => ({
          id: riga.materialId,
          code: riga.codice,
          description: riga.descrizione,
          brand: riga.marca,
          category: riga.categoria,
          unit: riga.unita,
          quantity: riga.quantitaAttuale,
          minThreshold: riga.sogliaMinima,
          location: riga.posizione,
          supplier: testata.fornitore || riga.fornitore || 'Senza fornitore',
          // quantita' decisa a mano nel modulo d'ordine
          suggestedQty: Number(riga.quantita || 0),
          unitPrice: Number(riga.prezzo || 0),
          lineDiscount: Number(riga.sconto || 0),
          rowNotes: riga.note,
        })),
        user,
        notes: riepilogo,
        multiplier: 1,
      });

      setMessaggio('Ordine salvato tra le proposte.');

      if (typeof onSalvato === 'function') onSalvato();

      setTimeout(() => setMessaggio(''), 4000);
    } catch (err) {
      console.error('Errore salvataggio ordine:', err);
      setErrore(err?.message || 'Errore durante il salvataggio dell’ordine.');
    } finally {
      setSalvataggio(false);
    }
  };

  // ----------------------------------------------------------
  // Documento PDF da inviare al fornitore
  // ----------------------------------------------------------

  const scaricaPDF = () => {
    if (righeIncluse.length === 0) {
      setErrore('Seleziona almeno un materiale da ordinare.');
      return;
    }

    generaPdfOrdine({ testata, righe: righeIncluse, totali });
  };

  // ----------------------------------------------------------

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal-xl ordine-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            <Icon name="request_quote" className="ui-inline-icon" aria-hidden="true" /> Ordine al
            fornitore
          </h2>

          <button type="button" className="modal-close" onClick={onChiudi} aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className="modal-body">
          {errore && <div className="alert alert-danger">{errore}</div>}
          {messaggio && <div className="alert alert-success">{messaggio}</div>}

          {/* ------------------ TESTATA ------------------ */}
          <div className="ordine-griglia">
            <section className="ordine-blocco">
              <h3>Ordine</h3>

              <label className="form-group">
                <span className="form-label">Numero ordine</span>
                <input
                  className="form-control"
                  value={testata.numero}
                  onChange={(e) => aggiornaTestata('numero', e.target.value)}
                />
              </label>

              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Data</span>
                  <input
                    className="form-control"
                    type="date"
                    value={testata.data}
                    onChange={(e) => aggiornaTestata('data', e.target.value)}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Consegna richiesta</span>
                  <input
                    className="form-control"
                    type="date"
                    value={testata.consegnaRichiesta}
                    onChange={(e) => aggiornaTestata('consegnaRichiesta', e.target.value)}
                  />
                </label>
              </div>

              <label className="form-group">
                <span className="form-label">Riferimento interno</span>
                <input
                  className="form-control"
                  value={testata.riferimentoInterno}
                  onChange={(e) => aggiornaTestata('riferimentoInterno', e.target.value)}
                  placeholder="Chi ha richiesto l’ordine"
                />
              </label>
            </section>

            <section className="ordine-blocco">
              <h3>Fornitore</h3>

              <label className="form-group">
                <span className="form-label">Ragione sociale</span>
                <input
                  className="form-control"
                  value={testata.fornitore}
                  onChange={(e) => aggiornaTestata('fornitore', e.target.value)}
                />
              </label>

              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Referente</span>
                  <input
                    className="form-control"
                    value={testata.fornitoreReferente}
                    onChange={(e) => aggiornaTestata('fornitoreReferente', e.target.value)}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Telefono</span>
                  <input
                    className="form-control"
                    value={testata.fornitoreTelefono}
                    onChange={(e) => aggiornaTestata('fornitoreTelefono', e.target.value)}
                  />
                </label>
              </div>

              <label className="form-group">
                <span className="form-label">Email</span>
                <input
                  className="form-control"
                  type="email"
                  value={testata.fornitoreEmail}
                  onChange={(e) => aggiornaTestata('fornitoreEmail', e.target.value)}
                />
              </label>

              <label className="form-group">
                <span className="form-label">Indirizzo</span>
                <input
                  className="form-control"
                  value={testata.fornitoreIndirizzo}
                  onChange={(e) => aggiornaTestata('fornitoreIndirizzo', e.target.value)}
                />
              </label>
            </section>

            <section className="ordine-blocco">
              <h3>Consegna</h3>

              <label className="form-group">
                <span className="form-label">Destinatario</span>
                <input
                  className="form-control"
                  value={testata.destinatario}
                  onChange={(e) => aggiornaTestata('destinatario', e.target.value)}
                />
              </label>

              <label className="form-group">
                <span className="form-label">Indirizzo di consegna</span>
                <input
                  className="form-control"
                  value={testata.indirizzoConsegna}
                  onChange={(e) => aggiornaTestata('indirizzoConsegna', e.target.value)}
                />
              </label>

              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Referente</span>
                  <input
                    className="form-control"
                    value={testata.referenteConsegna}
                    onChange={(e) => aggiornaTestata('referenteConsegna', e.target.value)}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Telefono</span>
                  <input
                    className="form-control"
                    value={testata.telefonoConsegna}
                    onChange={(e) => aggiornaTestata('telefonoConsegna', e.target.value)}
                  />
                </label>
              </div>

              <label className="form-group">
                <span className="form-label">Orari di ricevimento</span>
                <input
                  className="form-control"
                  value={testata.orariConsegna}
                  onChange={(e) => aggiornaTestata('orariConsegna', e.target.value)}
                  placeholder="es. lun-ven 8:00-12:00 / 14:00-17:00"
                />
              </label>
            </section>

            <section className="ordine-blocco">
              <h3>Condizioni</h3>

              <label className="form-group">
                <span className="form-label">Pagamento</span>
                <input
                  className="form-control"
                  list="condizioni-pagamento"
                  value={testata.pagamento}
                  onChange={(e) => aggiornaTestata('pagamento', e.target.value)}
                />
                <datalist id="condizioni-pagamento">
                  {CONDIZIONI_PAGAMENTO.map((voce) => (
                    <option key={voce} value={voce} />
                  ))}
                </datalist>
              </label>

              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">Spedizione</span>
                  <input
                    className="form-control"
                    list="modalita-spedizione"
                    value={testata.spedizione}
                    onChange={(e) => aggiornaTestata('spedizione', e.target.value)}
                  />
                  <datalist id="modalita-spedizione">
                    {MODALITA_SPEDIZIONE.map((voce) => (
                      <option key={voce} value={voce} />
                    ))}
                  </datalist>
                </label>

                <label className="form-group">
                  <span className="form-label">Porto</span>
                  <select
                    className="form-control"
                    value={testata.porto}
                    onChange={(e) => aggiornaTestata('porto', e.target.value)}
                  >
                    {PORTO.map((voce) => (
                      <option key={voce} value={voce}>
                        {voce}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label className="form-group">
                  <span className="form-label">IVA %</span>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    value={testata.iva}
                    onChange={(e) => aggiornaTestata('iva', Number(e.target.value))}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Sconto generale %</span>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    value={testata.scontoGenerale}
                    onChange={(e) => aggiornaTestata('scontoGenerale', Number(e.target.value))}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Trasporto €</span>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    step="0.01"
                    value={testata.speseTrasporto}
                    onChange={(e) => aggiornaTestata('speseTrasporto', Number(e.target.value))}
                  />
                </label>
              </div>
            </section>
          </div>

          {/* ------------------ RIGHE ------------------ */}
          <div className="ordine-righe-testata">
            <h3>
              Materiali da ordinare{' '}
              <span className="text-muted text-sm">
                ({righeIncluse.length} su {righe.length})
              </span>
            </h3>

            <div className="ordine-aggiunta">
              <input
                className="form-control"
                value={ricercaAggiunta}
                onChange={(e) => setRicercaAggiunta(e.target.value)}
                placeholder="Aggiungi un materiale: codice o descrizione"
              />

              <button type="button" className="btn btn-secondary btn-sm" onClick={aggiungiRigaLibera}>
                + Riga libera
              </button>

              {suggerimenti.length > 0 && (
                <div className="ordine-suggerimenti">
                  {suggerimenti.map((materiale) => (
                    <button
                      key={materiale.id}
                      type="button"
                      onClick={() => aggiungiMateriale(materiale)}
                    >
                      <strong>{materiale.code}</strong> {materiale.description}
                      <span className="text-muted"> · giac. {materiale.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="data-table ordine-tabella">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Ord.</th>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th style={{ width: 70 }}>UM</th>
                  <th style={{ width: 90 }}>Q.tà</th>
                  <th style={{ width: 110 }}>Prezzo</th>
                  <th style={{ width: 80 }}>Sc. %</th>
                  <th style={{ width: 110 }}>Totale</th>
                  <th>Note riga</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>

              <tbody>
                {righe.map((riga) => (
                  <tr key={riga.idRiga} className={riga.incluso ? '' : 'ordine-riga-esclusa'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={riga.incluso}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'incluso', e.target.checked)}
                        aria-label="Includi nell’ordine"
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={riga.codice}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'codice', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={riga.descrizione}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'descrizione', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={riga.unita}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'unita', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        step="1"
                        value={riga.quantita}
                        onChange={(e) =>
                          aggiornaRiga(riga.idRiga, 'quantita', Number(e.target.value))
                        }
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={riga.prezzo}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'prezzo', Number(e.target.value))}
                      />
                    </td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        max="100"
                        value={riga.sconto}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'sconto', Number(e.target.value))}
                      />
                    </td>

                    <td className="numeric fw-semibold">{formatCurrency(totaleRiga(riga))}</td>

                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={riga.note}
                        onChange={(e) => aggiornaRiga(riga.idRiga, 'note', e.target.value)}
                        placeholder="es. urgente, colore, misura"
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => rimuoviRiga(riga.idRiga)}
                        title="Togli la riga"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}

                {righe.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted">
                      Nessun materiale nell’ordine: cercane uno qui sopra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ------------------ NOTE E TOTALI ------------------ */}
          <div className="ordine-chiusura">
            <label className="form-group ordine-note">
              <span className="form-label">Note per il fornitore</span>
              <textarea
                className="form-control"
                rows={4}
                value={testata.note}
                onChange={(e) => aggiornaTestata('note', e.target.value)}
                placeholder="Indicazioni su consegna, imballo, riferimenti di cantiere…"
              />
            </label>

            <div className="ordine-totali">
              <div>
                <span>Imponibile</span>
                <strong>{formatCurrency(totali.imponibileLordo)}</strong>
              </div>

              {Number(testata.scontoGenerale) > 0 && (
                <div>
                  <span>Sconto {testata.scontoGenerale}%</span>
                  <strong>- {formatCurrency(totali.scontoGenerale)}</strong>
                </div>
              )}

              {Number(testata.speseTrasporto) > 0 && (
                <div>
                  <span>Trasporto</span>
                  <strong>{formatCurrency(totali.trasporto)}</strong>
                </div>
              )}

              <div>
                <span>IVA {testata.iva}%</span>
                <strong>{formatCurrency(totali.iva)}</strong>
              </div>

              <div className="ordine-totale-finale">
                <span>Totale ordine</span>
                <strong>{formatCurrency(totali.totale)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onChiudi}>
            Chiudi
          </button>

          <button type="button" className="btn btn-secondary" onClick={scaricaPDF}>
            <Icon name="receipt_long" className="ui-inline-icon" aria-hidden="true" /> Scarica PDF
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={salvaProposta}
            disabled={salvataggio}
          >
            {salvataggio ? 'Salvataggio...' : 'Salva come proposta'}
          </button>
        </div>
      </div>
    </div>
  );
}
