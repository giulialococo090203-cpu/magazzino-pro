# WorkSpace — passaggio ad azienda unica + area programmatore

Data: 8 settembre 2026

## Cosa è cambiato

### 1. Niente più multi-azienda
- L'azienda è una sola ed è definita in `src/config/azienda.js`
  (`cl_thermoservice` / Thermoservice), sovrascrivibile con le variabili
  `VITE_AZIENDA_ID` e `VITE_AZIENDA_NOME`.
- Il login non chiede più il **codice azienda**: solo email e password.
- Rimossi i **piani di abbonamento** (Base/Pro/Enterprise): tutte le funzioni
  sono disponibili e l'accesso è regolato solo dai permessi utente.
- Rimossa la pagina "Monitoraggio Aziendale" e le API di creazione/modifica/
  eliminazione azienda.
- `getCurrentCompanyId()` restituisce sempre l'unica azienda: tutte le query
  restano filtrate su `azienda_id`, quindi i dati esistenti non si toccano.

### 2. Nuova area programmatore (supporto)
Percorso: **`/programmatore`** — visibile nel menu laterale solo alle email
autorizzate (`VITE_PROGRAMMER_EMAIL` lato app, `PROGRAMMER_EMAIL` lato server)
o agli utenti con ruolo `sviluppatore` / `super_admin` / `admin_tecnico`.

L'ingresso è protetto da un **codice d'accesso**:
- il codice è salvato solo come impronta cifrata (SHA-256) su Supabase;
- **il primo codice che inserisci diventa quello ufficiale** (nessun codice
  predefinito, quindi nessun rischio di restare fuori);
- si può sostituire quando vuoi dalla scheda "Codice d'accesso".

Cosa contiene il pannello:
| Scheda | A cosa serve |
| --- | --- |
| Stato app | Diagnostica completa: autenticazione, ogni tabella dati, archivio file, servizio lettura PDF, API di supporto, con tempi di risposta e memoria occupata |
| Andamento | Movimenti e fatture degli ultimi 6 mesi, utenti attivi, materiali da riordinare, notifiche non lette, ultime attività registrate |
| Integrità dati | Record incoerenti (senza azienda, senza categoria, quantità negative...) e pulsante per ripararli |
| Codice d'accesso | Stato e sostituzione del codice |
| Manutenzione | Blocca l'app per gli utenti con un messaggio; tu continui a lavorarci |
| Utenti | Sblocca/blocca utenti, invia email di reset password, ricrea l'account datore in emergenza |

### 3. Modalità manutenzione
Quando è attiva, tutti gli utenti dell'azienda vedono la schermata
"Manutenzione in corso"; il programmatore continua ad accedere normalmente.
Lo stato viene ricontrollato ogni 60 secondi.

## Cosa devi fare per attivare tutto

1. **Migration 1 — `supabase/migrations/20260908_azienda_unica.sql`** ✅ già eseguita
   l'8 settembre 2026. Ha creato la tabella `configurazione_app` e la vista
   `stato_app_pubblico`.

2. **Migration 2 — `supabase/migrations/20260908_pulizia_multi_azienda.sql`** ✅ eseguita
   l'8 settembre 2026. Elimina definitivamente i dati delle aziende di test, lascia
   in `aziende` la sola `cl_thermoservice`, rimuove le colonne
   dell'abbonamento e riscrive le regole di sicurezza (RLS) legandole
   all'unica azienda. **Operazione irreversibile**: apri il file, copia tutto,
   incolla nell'SQL editor di Supabase e premi Run.

3. **Variabili d'ambiente lato server** (Cloudflare Pages / Vercel):
   - `PROGRAMMER_EMAIL` = la tua email (già presente in `.dev.vars`)
   - `AZIENDA_ID` = `cl_thermoservice`
   - restano necessarie `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
     `VITE_FIREBASE_API_KEY`

4. **Variabili lato app** (già aggiunte in `.env`):
   `VITE_AZIENDA_ID`, `VITE_AZIENDA_NOME`, `VITE_PROGRAMMER_EMAIL`

5. Avvia con `npm run dev`, entra in `/programmatore` e imposta il codice
   d'accesso al primo ingresso.

## File spostati
La cartella `_archivio_multi_azienda/` contiene i file della vecchia
architettura (pagina aziende, piani di abbonamento, API azienda). Non sono più
usati: puoi eliminarli quando vuoi.
Anche la cartella vuota `src/pages/super/` può essere eliminata a mano.

## Pulizia lato backend (migration 2)

Dati eliminati dalle aziende di test `cl_test`, `cl_test2`, `cl_test3` e
dall'ambiente tecnico `programmatore`:

| tabella | record |
| --- | --- |
| utenti | 80 |
| categorie | 120 |
| materiali | 22.419 |
| movimenti | 110.010 |
| fatture importate | 14 (con relativi file) |

Restano esclusivamente i dati di Thermoservice.

Rimosse anche dal codice le logiche residue del modello multi-azienda:
il limite utenti da abbonamento (`store.js`, `create-user.js`,
`create-company-owner.js`) e gli script di seed/stress test delle aziende
demo, spostati in `_archivio_multi_azienda/scripts/`.

## Sicurezza — com'è messa davvero

Verificando il database ho scoperto che è **più protetto di quanto
raccontassero le migration nel repository**: quei file erano rimasti
indietro rispetto alla configurazione reale.

Come funziona oggi:

- `src/supabaseClient.js` allega a ogni richiesta il **token Firebase**
  dell'utente collegato. Supabase riconosce quel token (Third-Party Auth) e
  tratta la richiesta come utente autenticato.
- Tutte le tabelle dei dati hanno le regole di accesso riservate agli utenti
  autenticati: **con la sola chiave pubblica non si legge e non si scrive
  niente**. Verificato: una richiesta senza token torna vuota.
- La tabella `utenti` non è raggiungibile dal browser: si legge solo
  attraverso le API server-side.
- `configurazione_app` (impronta del codice d'accesso) è chiusa a chiave:
  la leggono solo le API server-side.

Il punto debole non era quindi l'esposizione dei dati, ma la **fragilità**:
le regole leggevano l'azienda da un *claim* scritto sull'utente Firebase,
da tenere sincronizzato con uno script (`sync-firebase-claims.mjs`). Se il
claim mancava o era vecchio, l'utente si autenticava ma non vedeva più i
propri dati — esattamente il tipo di problema che ti faceva perdere tempo.

La sezione 1 della migration 2 elimina questa dipendenza: con una sola
azienda, l'accesso viene concesso se il token appartiene a un utente
**attivo** presente in anagrafica. Niente più claim da sincronizzare,
niente più utenti che "spariscono", e gli account di test restano
comunque fuori. In fondo al file c'è l'istruzione per tornare indietro
se qualcosa non tornasse.

## Gestione utenti riparata

Controllando le regole del database è emerso che la tabella `utenti` non è
scrivibile dal browser (RLS attiva, nessuna regola per il client). Di
conseguenza, nella pagina Gestione Utenti:

- la **modifica** di un utente falliva,
- l'**eliminazione** non faceva nulla, perché puntava a un endpoint
  (`/api/admin/delete-user`) che non esisteva.

Ho aggiunto i due endpoint server-side mancanti — `functions/api/admin/update-user.js`
e `functions/api/admin/delete-user.js` — che verificano il token Firebase e
consentono l'operazione solo al datore dell'azienda o al programmatore, e ho
collegato `userStore.update` / `userStore.delete` a quelli. Rimossa anche la
copia di compatibilità che il browser tentava di scrivere in `utenti` a ogni
creazione utente: falliva sempre in silenzio, ora il profilo lo scrive
soltanto il server.

Nota: l'eliminazione rimuove il profilo applicativo, non l'account Firebase.
Senza profilo l'utente non può più accedere.

## Archivio fatture: falla chiusa

Dopo la pulizia ho controllato anche il bucket `fatture` e ho trovato un
problema più serio di quelli sistemati finora: i file erano accessibili al
**ruolo anonimo**. Chiunque conoscesse la chiave pubblica del sito — che è
inclusa nel codice dell'applicazione, quindi leggibile da chiunque apra il
sito — poteva scaricare, sostituire o cancellare le fatture dell'azienda
**senza fare login**.

L'ho verificato praticamente: i 14 file rimasti orfani dalle aziende di test
li ho eliminati proprio così, con la sola chiave pubblica e nessuna
autenticazione.

La migration `20260908_sicurezza_storage.sql` chiude l'accesso: le stesse
operazioni restano possibili solo agli utenti autenticati con Firebase, come
per tutti gli altri dati. L'applicazione non va toccata: apre i documenti con
link firmati, generati da utente autenticato.

## Stato finale del database (8 settembre 2026)

| controllo | esito |
| --- | --- |
| aziende presenti | 1 — Thermoservice |
| dati estranei (materiali, movimenti) | 0 |
| utenti attivi | 29, tutti con email valida |
| colonne abbonamento | rimosse |
| regole per il ruolo anonimo | 0 su tutte le tabelle |
| accesso ai dati senza login | negato (verificato) |
| codice d'accesso programmatore | non leggibile dal browser (verificato) |
| stato manutenzione | leggibile senza login, come serve alla schermata di accesso |
| `current_company_id()` con un utente reale | restituisce `cl_thermoservice` (verificato) |

## Ultimi accorgimenti

- **`public/_redirects`** (nuovo): su Cloudflare Pages ogni indirizzo che non
  corrisponde a un file deve servire `index.html`, altrimenti aprire o
  ricaricare direttamente `/programmatore` o `/inventario` darebbe "pagina non
  trovata". Le funzioni in `functions/api` mantengono la precedenza.
- **Conteggi utenti nel pannello programmatore**: la tabella `utenti` non è
  leggibile dal browser, quindi diagnostica, andamento e integrità la
  interrogavano ottenendo sempre zero. Ora passano dall'API server-side e i
  numeri sono reali.
- **Variabili d'ambiente**: `AZIENDA_ID` è facoltativa — il codice usa
  `cl_thermoservice` come valore predefinito. L'unica davvero necessaria lato
  server è **`PROGRAMMER_EMAIL`**: se manca, entrando nell'area programmatore
  compare "PROGRAMMER_EMAIL non configurata nel backend". Va impostata dove è
  pubblicata l'applicazione (Cloudflare Pages → Settings → Environment
  variables), insieme a `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
  `VITE_FIREBASE_API_KEY`.

## Attenzione allo sviluppo in locale

`npm run dev` avvia soltanto Vite, che non esegue le funzioni in
`functions/api`. Tutte le rotte `/api/...` rispondono quindi **404**: area
programmatore, creazione, modifica ed eliminazione utenti sembrano rotte,
mentre in produzione su Cloudflare Pages funzionano regolarmente.

Per provarle in locale si usa `npm run dev:api`, che avvia le funzioni
insieme all'interfaccia leggendo le variabili da `.dev.vars`, e pubblica
l'app su `http://localhost:8788`.

I due punti dell'applicazione che chiamano le API mostrano ora un messaggio
esplicito quando ricevono 404, invece del generico "Errore richiesta (404)".

## Nuova veste grafica e modalità scura

Il foglio di stile aveva **815 colori scritti a mano** e 865 trasparenze:
in quelle condizioni una modalità scura non era realizzabile. Li ho convertiti
tutti in variabili di tema (781 colori e 437 trasparenze; sono rimasti solo i
neri delle ombre), poi ho definito la palette richiesta in chiaro e in scuro.

Da qui in avanti, per cambiare un colore dell'interfaccia basta modificare una
variabile in fondo a `src/index.css`.

- Interruttore chiaro/scuro in alto a destra, su login, applicazione e
  schermata di manutenzione. La scelta resta salvata sul dispositivo; se non
  se ne fa una, si segue l'impostazione del sistema.
- `src/utils/theme.js` gestisce lettura, salvataggio e ascolto delle
  preferenze di sistema; `src/main.jsx` applica il tema prima del primo
  disegno, così non si vede il lampo di colore all'avvio.
- L'area programmatore ha una veste propria (`.area-programmatore`): fondo
  scuro, accento bordeaux e una fascia fissa in alto con la scritta "Area
  programmatore — supporto tecnico".
- In `public/workspace-logo-verde.png` c'è il logo riportato sui verdi della
  palette, alleggerito da 2,3 MB a 419 kB. Non sostituisce l'originale: per
  usarlo basta cambiare il nome del file nei quattro punti in cui compare
  `/workspace-logo.png`.

## Ricerca in Giacenza più rapida

- L'attesa prima di interrogare il server è scesa da 300 a 140 millisecondi.
- Mentre il server risponde, l'elenco già a schermo si restringe subito: la
  lista reagisce mentre si digita invece di restare ferma.
- I risultati vengono ordinati per pertinenza: prima il codice identico, poi
  quelli che iniziano col testo cercato, poi il resto.
- Le ultime 40 ricerche restano in memoria: cancellare una lettera o tornare
  su un termine appena cercato è istantaneo.
- Il conteggio totale dei risultati viene chiesto solo alla prima pagina:
  costava quanto la ricerca stessa e veniva rifatto a ogni "carica altri".

## Marchio nuovo

I due file che erano sulla Scrivania sono stati copiati dentro il progetto,
in `public/`: da lì fanno parte del sito, quindi restano anche cancellandoli
dal computer.

- `logo.png` — barra laterale, login (desktop e telefono), icona della scheda
  del browser e icona su iOS. Da 1273 kB a **223 kB**.
- `sfondo-home.jpg` — fascia di apertura della Dashboard e pannello di
  benvenuto del login. Da 1015 kB a **41 kB** (convertito in JPEG: è
  un'immagine fotografica senza trasparenze).

I loghi precedenti sono stati tolti dal sito e conservati in
`_archivio_multi_azienda/loghi-precedenti/`: erano 2,7 MB che venivano
pubblicati a ogni caricamento senza essere più usati.

## Area programmatore: console separata

- **Segue la modalità scelta.** Prima restava scura anche di giorno: ora
  chiara in modalità chiara, scura in modalità scura. A distinguerla è il
  colore guida, che diventa bordeaux al posto del verde, insieme alla barra
  laterale scura e alla fascia fissa in alto.
- **Non mostra più l'applicazione aziendale.** Entrando, il menu laterale
  cambia completamente: spariscono Giacenza, Movimenti, Fatture e le altre
  sezioni, e restano solo gli strumenti tecnici, divisi in *Diagnostica*
  (stato app, andamento, integrità dati), *Interventi* (manutenzione, utenti
  e accessi, codice d'accesso) e il rientro all'applicazione.
- **Ogni strumento ha il suo indirizzo** (`/programmatore/stato`,
  `/programmatore/utenti`, …), quindi si può arrivare direttamente a una
  sezione e il menu evidenzia dove ci si trova.

## Icona del sito

`index.html` è stato riscritto: icona della scheda, icona su iOS e colore
della barra del browser ora usano il logo nuovo e la palette. Se nella scheda
vedi ancora la vecchia icona arancione è la memoria del browser: basta un
ricaricamento forzato (⌘⇧R).

## Riconoscimento materiali nell'import fatture

Il motore confrontava ogni riga del documento con **tutti** i materiali del
magazzino, rinormalizzando ogni volta gli stessi testi e calcolando la
distanza carattere per carattere su migliaia di descrizioni.

Ora il magazzino viene preparato una volta sola e indicizzato per codice e
per parola: ogni riga confronta poche decine di candidati invece di 6.280.
La distanza fra due testi usa due righe di memoria invece dell'intera
matrice e si ferma subito se le lunghezze sono troppo diverse.

Misurato su 6.300 materiali e 40 righe di fattura: **da 3.556 ms a 179 ms**,
con gli stessi abbinamenti trovati. Unica differenza voluta: a parità di
punteggio ora vince il materiale col **codice identico**, che è l'unico
abbinamento di cui ci si possa fidare.

## Modulo d'ordine al fornitore

Dalla pagina Riordino Automatico, il pulsante **Prepara ordine** apre un vero
modulo d'ordine (`src/pages/principale/ComposizioneOrdine.jsx`):

- ogni materiale ha una **casella da spuntare** per includerlo o escluderlo,
  quantità, prezzo e sconto **modificabili**, una **nota di riga** e il
  pulsante per toglierlo del tutto;
- si possono **aggiungere altri materiali** cercandoli nel magazzino, oppure
  inserire una riga libera scritta a mano;
- testata completa: numero e data ordine, consegna richiesta, riferimento
  interno, dati del fornitore (referente, email, telefono, indirizzo),
  indirizzo e orari di consegna, condizioni di pagamento, modalità di
  spedizione e porto;
- totali calcolati in tempo reale: imponibile, sconto generale, spese di
  trasporto, IVA e totale ordine;
- **Salva come proposta** lo archivia tra le proposte d'ordine con tutta la
  testata nelle note; **Scarica PDF** produce il documento da inviare al
  fornitore, con spazio per timbro e firma.

I colori di tutti i PDF generati dall'applicazione sono ora centralizzati in
`src/utils/pdfTheme.js` e seguono la palette: intestazioni antracite, linee e
totali verde oliva, righe alternate color crema, avvisi bordeaux.
