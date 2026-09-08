# WorkSpace — Gestione Magazzino

Applicazione web per la gestione del magazzino aziendale: giacenze, movimenti,
fatture, fornitori, riordini, inventario fisico, rendicontazione economica e
notifiche.

L'applicazione è **mono-azienda**: serve una sola azienda
(`cl_thermoservice` — Thermoservice) e non prevede più né la selezione
dell'azienda al login né i piani di abbonamento.

## Come si accede

- **Utenti aziendali** — email e password (account Firebase). Le funzioni
  visibili dipendono dai permessi assegnati al singolo utente.
- **Programmatore (supporto tecnico)** — stessa login, più un **codice
  d'accesso** richiesto all'ingresso dell'area `/programmatore`.

## Ruoli e permessi

Ruoli previsti: `operaio`, `magazziniere`, `segretaria`, `datore`.
I permessi predefiniti per ruolo sono in `src/data/permissions.js` e possono
essere personalizzati per singolo utente dalla pagina Gestione Utenti.

## Area programmatore

Riservata al supporto tecnico (`/programmatore`), protetta da codice d'accesso:

- **Stato app** — diagnostica di autenticazione, tabelle, archivio file,
  servizio di lettura PDF e API, con tempi di risposta e memoria occupata
- **Andamento** — movimenti e fatture per mese, utenti attivi, materiali da
  riordinare, ultime attività
- **Integrità dati** — record incoerenti e riparazione
- **Codice d'accesso** — sostituzione del codice
- **Manutenzione** — blocco temporaneo dell'app per gli utenti
- **Utenti** — sblocco utenti, reset password, ripristino account datore

## Aspetto e temi

Tutti i colori dell'interfaccia passano da un unico gruppo di variabili CSS,
definite in fondo a `src/index.css`:

| ruolo | chiaro | scuro |
| --- | --- | --- |
| sfondo | `#f6f4ef` | `#232a27` |
| superfici (card) | `#ffffff` | `#2f3632` |
| testo | `#1f2321` | `#e6e8e6` |
| primario | `#657a45` | `#7a8f5a` |
| bordi | `#d9d4c7` | `#444c47` |
| accento | `#8d2e38` | `#a1454f` |

La modalità scura si attiva con l'attributo `data-theme="dark"` sull'elemento
`<html>`; il pulsante è in alto a destra, la scelta resta salvata sul
dispositivo e, finché non se ne sceglie una, si segue l'impostazione del
sistema operativo (`src/utils/theme.js`).

L'area programmatore ridefinisce le stesse variabili su `.area-programmatore`
con veste scura e accento bordeaux: è sempre riconoscibile a colpo d'occhio,
in qualunque modalità si stia lavorando.

Per cambiare un colore dell'applicazione si modifica **solo** il valore della
variabile: non ci sono più colori scritti a mano nei singoli stili.

## Immagini del marchio

Vivono dentro il progetto, in `public/`, quindi fanno parte del sito e non
dipendono da file sul computer:

| file | dove compare |
| --- | --- |
| `logo.png` | barra laterale, login, icona della scheda del browser, icona su iOS |
| `sfondo-home.jpg` | fascia di apertura della Dashboard e pannello di benvenuto del login |

Per sostituirle basta rimpiazzare i due file mantenendo gli stessi nomi.
Le versioni precedenti del logo sono conservate in
`_archivio_multi_azienda/loghi-precedenti/`.

## Stack

- React 19 + Vite
- Firebase Authentication
- Supabase (PostgreSQL + Storage)
- Cloudflare Pages Functions per le operazioni privilegiate (`functions/api`)

## Sviluppo

```bash
npm install
npm run dev      # avvio rapido: solo interfaccia
npm run dev:api  # avvio completo: interfaccia + funzioni server
npm run lint     # controllo del codice
npm run build    # build di produzione
```

**Quale dei due usare.** `npm run dev` avvia solo Vite: le rotte `/api/...`
non esistono, quindi area programmatore, creazione e modifica utenti
rispondono 404. Per lavorare su quelle parti serve `npm run dev:api`, che
avvia le funzioni di Cloudflare Pages insieme all'interfaccia (legge le
variabili da `.dev.vars`) e pubblica l'app su
[http://localhost:8788](http://localhost:8788) — è quello l'indirizzo da
aprire, non quello di Vite.

## Variabili d'ambiente

Lato applicazione (`.env`):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PDF_PARSER_URL
VITE_AZIENDA_ID
VITE_AZIENDA_NOME
VITE_PROGRAMMER_EMAIL
```

Lato server (Cloudflare / Vercel):

```
VITE_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VITE_FIREBASE_API_KEY
PROGRAMMER_EMAIL
AZIENDA_ID
```

## Struttura

```
src/config/       configurazione azienda unica
src/data/         accesso ai dati, autenticazione, permessi, supporto tecnico
src/pages/        pagine dell'applicazione
src/components/   layout e componenti condivisi
functions/api/    endpoint server-side (utenti, profilo, area programmatore)
supabase/         migration del database
scripts/          utilità di manutenzione (backup, conteggi, reset)
```

## Documentazione

- `MIGRAZIONE_AZIENDA_UNICA.md` — passaggio da multi-azienda ad azienda unica
- `_archivio_multi_azienda/` — file della vecchia architettura, non più usati
