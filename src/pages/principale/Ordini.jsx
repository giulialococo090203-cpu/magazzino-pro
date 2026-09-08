import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import RiordinoAutomatico from './RiordinoAutomatico';
import ArchivioProposteOrdine from './ArchivioProposteOrdine';

/*
 * Una sola voce di menu per tutto il ciclo dell'ordine:
 *   1. cosa manca in magazzino  ->  2. ordini preparati e inviati
 * Le due parti erano pagine separate che sembravano fare la stessa cosa.
 */

const SEZIONI = [
  {
    chiave: 'da-ordinare',
    etichetta: 'Da ordinare',
    descrizione: 'I materiali sotto soglia, raccolti per fornitore',
  },
  {
    chiave: 'preparati',
    etichetta: 'Ordini preparati',
    descrizione: 'Da inviare, inviati e completati',
  },
];

const CHIAVI = SEZIONI.map((sezione) => sezione.chiave);

export default function Ordini() {
  const { sezione } = useParams();
  const navigate = useNavigate();

  const attiva = CHIAVI.includes(sezione) ? sezione : 'da-ordinare';

  const [daOrdinare, setDaOrdinare] = useState(null);
  const [daInviare, setDaInviare] = useState(null);

  /*
   * Una sezione viene caricata la prima volta che la si apre, e poi resta
   * pronta: aprire "Ordini" non deve tirare giù tutto il magazzino e tutti
   * gli ordini insieme.
   */
  const [visitate, setVisitate] = useState({ [attiva]: true });

  useEffect(() => {
    setVisitate((precedenti) =>
      precedenti[attiva] ? precedenti : { ...precedenti, [attiva]: true }
    );
  }, [attiva]);

  const conteggi = {
    'da-ordinare': daOrdinare,
    preparati: daInviare,
  };

  const descrizioneAttiva = SEZIONI.find((voce) => voce.chiave === attiva)?.descrizione;

  return (
    <div className="animate-slideUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Icon name="shopping_cart" className="ui-title-icon" aria-hidden="true" />
            Ordini
          </h1>
          <p className="page-subtitle">{descrizioneAttiva}</p>
        </div>
      </div>

      <div className="ordini-sezioni" role="tablist">
        {SEZIONI.map((voce) => {
          const conteggio = conteggi[voce.chiave];

          return (
            <button
              key={voce.chiave}
              type="button"
              role="tab"
              aria-selected={attiva === voce.chiave}
              className={`ordini-sezione ${attiva === voce.chiave ? 'attiva' : ''}`}
              onClick={() => navigate(`/ordini/${voce.chiave}`)}
            >
              <span className="ordini-sezione-testo">{voce.etichetta}</span>

              {conteggio !== null && conteggio !== undefined && (
                <span className="ordini-sezione-conteggio">{conteggio}</span>
              )}
            </button>
          );
        })}
      </div>

      {/*
        Una volta aperta, la sezione resta montata: tornando indietro non si
        ricarica nulla e non si perde quello che si stava selezionando.
      */}
      {visitate['da-ordinare'] && (
        <div hidden={attiva !== 'da-ordinare'}>
          <RiordinoAutomatico incorporato onConteggio={setDaOrdinare} />
        </div>
      )}

      {visitate.preparati && (
        <div hidden={attiva !== 'preparati'}>
          <ArchivioProposteOrdine incorporato onConteggio={setDaInviare} />
        </div>
      )}
    </div>
  );
}
