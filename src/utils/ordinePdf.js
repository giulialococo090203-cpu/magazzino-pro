import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_COLORS } from './pdfTheme';
import { AZIENDA_NOME } from '../config/azienda';

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value || 0));
}

function formatData(valore) {
  if (!valore) return '—';

  const data = new Date(valore);

  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('it-IT');
}

/**
 * Documento d'ordine da inviare al fornitore.
 * Lo usano sia il modulo di composizione sia l'archivio proposte,
 * così il documento è sempre lo stesso.
 *
 * @param {object} dati
 * @param {object} dati.testata   intestazione dell'ordine
 * @param {Array}  dati.righe     righe già filtrate (solo quelle da ordinare)
 * @param {object} dati.totali    imponibile, sconti, iva, totale
 */
export function generaPdfOrdine({ testata, righe, totali }) {
  const righeIncluse = righe;
  const totaleRiga = (riga) => {
    const lordo = Number(riga.quantita || 0) * Number(riga.prezzo || 0);
    return lordo * (1 - Number(riga.sconto || 0) / 100);
  };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const larghezza = doc.internal.pageSize.getWidth();

    // Intestazione
    doc.setFillColor(...PDF_COLORS.graphite);
    doc.rect(0, 0, larghezza, 26, 'F');

    doc.setTextColor(...PDF_COLORS.white);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('ORDINE AL FORNITORE', 14, 12);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(AZIENDA_NOME, 14, 19);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(testata.numero, larghezza - 14, 12, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.text(`del ${formatData(testata.data)}`, larghezza - 14, 18, { align: 'right' });

    // Linea del colore primario
    doc.setFillColor(...PDF_COLORS.primary);
    doc.rect(0, 26, larghezza, 1.6, 'F');

    // Riquadri fornitore e consegna
    const y = 36;

    doc.setDrawColor(...PDF_COLORS.border);
    doc.setFillColor(...PDF_COLORS.cream);
    doc.roundedRect(14, y, 86, 42, 2, 2, 'FD');
    doc.roundedRect(larghezza - 100, y, 86, 42, 2, 2, 'FD');

    doc.setTextColor(...PDF_COLORS.primaryDark);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('FORNITORE', 18, y + 6);
    doc.text('CONSEGNARE A', larghezza - 96, y + 6);

    doc.setTextColor(...PDF_COLORS.text);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');

    const bloccoFornitore = [
      testata.fornitore || '—',
      testata.fornitoreReferente && `c.a. ${testata.fornitoreReferente}`,
      testata.fornitoreIndirizzo,
      testata.fornitoreEmail,
      testata.fornitoreTelefono,
    ].filter(Boolean);

    const bloccoConsegna = [
      testata.destinatario || AZIENDA_NOME,
      testata.indirizzoConsegna,
      testata.referenteConsegna && `Referente: ${testata.referenteConsegna}`,
      testata.telefonoConsegna,
      testata.orariConsegna && `Orari: ${testata.orariConsegna}`,
    ].filter(Boolean);

    bloccoFornitore.forEach((riga, indice) => {
      doc.text(String(riga).slice(0, 46), 18, y + 13 + indice * 5.4);
    });

    bloccoConsegna.forEach((riga, indice) => {
      doc.text(String(riga).slice(0, 46), larghezza - 96, y + 13 + indice * 5.4);
    });

    // Condizioni
    const yCondizioni = y + 48;

    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(
      `Consegna richiesta: ${formatData(testata.consegnaRichiesta)}   ·   Pagamento: ${testata.pagamento}`,
      14,
      yCondizioni
    );
    doc.text(
      `Spedizione: ${testata.spedizione}   ·   ${testata.porto}   ·   Riferimento: ${testata.riferimentoInterno || '—'}`,
      14,
      yCondizioni + 5
    );

    // Righe dell'ordine
    autoTable(doc, {
      startY: yCondizioni + 11,
      head: [['#', 'Codice', 'Descrizione', 'UM', 'Q.tà', 'Prezzo', 'Sc. %', 'Totale', 'Note']],
      body: righeIncluse.map((riga, indice) => [
        indice + 1,
        riga.codice || '—',
        riga.descrizione || '—',
        riga.unita || '',
        Number(riga.quantita || 0),
        formatCurrency(riga.prezzo),
        Number(riga.sconto || 0) ? `${riga.sconto}%` : '',
        formatCurrency(totaleRiga(riga)),
        riga.note || '',
      ]),
      styles: { fontSize: 7.6, cellPadding: 2, overflow: 'linebreak', textColor: PDF_COLORS.text },
      headStyles: {
        fillColor: PDF_COLORS.graphite,
        textColor: PDF_COLORS.white,
        lineColor: PDF_COLORS.primary,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: PDF_COLORS.cream },
      columnStyles: {
        0: { cellWidth: 8 },
        3: { cellWidth: 10 },
        4: { cellWidth: 13, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 12, halign: 'right' },
        7: { cellWidth: 22, halign: 'right' },
      },
    });

    // Totali
    let yTotali = (doc.lastAutoTable?.finalY || yCondizioni + 40) + 8;

    if (yTotali > 240) {
      doc.addPage();
      yTotali = 20;
    }

    const voci = [
      ['Imponibile', formatCurrency(totali.imponibileLordo)],
      Number(testata.scontoGenerale) > 0
        ? [`Sconto ${testata.scontoGenerale}%`, `- ${formatCurrency(totali.scontoGenerale)}`]
        : null,
      Number(testata.speseTrasporto) > 0
        ? ['Spese di trasporto', formatCurrency(totali.trasporto)]
        : null,
      [`IVA ${testata.iva}%`, formatCurrency(totali.iva)],
    ].filter(Boolean);

    doc.setFontSize(9);

    voci.forEach((voce, indice) => {
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(voce[0], larghezza - 78, yTotali + indice * 6);
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(voce[1], larghezza - 14, yTotali + indice * 6, { align: 'right' });
    });

    const yTotale = yTotali + voci.length * 6 + 2;

    doc.setFillColor(...PDF_COLORS.primary);
    doc.rect(larghezza - 82, yTotale, 68, 9, 'F');
    doc.setTextColor(...PDF_COLORS.white);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('TOTALE ORDINE', larghezza - 79, yTotale + 6);
    doc.text(formatCurrency(totali.totale), larghezza - 17, yTotale + 6, { align: 'right' });

    // Note e firma
    let yNote = yTotale + 18;

    if (testata.note) {
      doc.setTextColor(...PDF_COLORS.primaryDark);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('NOTE', 14, yNote);

      doc.setTextColor(...PDF_COLORS.text);
      doc.setFont(undefined, 'normal');
      doc.text(doc.splitTextToSize(testata.note, larghezza - 100), 14, yNote + 5);

      yNote += 5 + Math.min(4, doc.splitTextToSize(testata.note, larghezza - 100).length) * 4.6;
    }

    doc.setDrawColor(...PDF_COLORS.border);
    doc.line(larghezza - 78, yNote + 14, larghezza - 14, yNote + 14);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFontSize(7.5);
    doc.text('Timbro e firma per accettazione', larghezza - 78, yNote + 18);

    doc.save(`${testata.numero}_${(testata.fornitore || 'fornitore').replace(/[^\w]+/g, '_')}.pdf`);
  
}

export default generaPdfOrdine;
