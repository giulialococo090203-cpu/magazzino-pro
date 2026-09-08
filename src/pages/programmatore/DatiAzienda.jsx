import { useParams, Navigate } from 'react-router-dom';
import Inventario from '../principale/Inventario';
import StoricoMovimenti from '../principale/StoricoMovimenti';
import ArchivioFatture from '../principale/ArchivioFatture';
import Ordini from '../principale/Ordini';
import GestioneUtenti from '../gestione/GestioneUtenti';
import LogModifiche from '../gestione/LogModifiche';

/*
 * I dati veri dell'azienda, guardati dalla console tecnica.
 * Sono le stesse pagine che usano gli operatori: servono per vedere
 * con i propri occhi cosa non torna e intervenire.
 */

const PAGINE_DATI = {
  giacenza: { titolo: 'Giacenza', componente: Inventario },
  movimenti: { titolo: 'Storico movimenti', componente: StoricoMovimenti },
  fatture: { titolo: 'Archivio fatture', componente: ArchivioFatture },
  ordini: { titolo: 'Ordini', componente: Ordini },
  utenti: { titolo: 'Utenti', componente: GestioneUtenti },
  registro: { titolo: 'Registro modifiche', componente: LogModifiche },
};

export default function DatiAzienda() {
  const { pagina } = useParams();

  const voce = PAGINE_DATI[pagina];

  if (!voce) {
    return <Navigate to="/programmatore/dati/giacenza" replace />;
  }

  const Componente = voce.componente;

  return (
    <div className="prog-dati">
      <div className="prog-dati-avviso">
        <strong>{voce.titolo}</strong> — stai guardando i dati reali dell’azienda dalla console
        tecnica. Ogni modifica fatta qui è una modifica vera.
      </div>

      <Componente />
    </div>
  );
}
