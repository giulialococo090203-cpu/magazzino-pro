# Quando l'app si apre ma le pagine sono vuote

## Cosa succede

Si entra normalmente, il menu c'e', il nome utente in basso e' quello giusto,
ma la giacenza dice "0 materiali trovati" e gli altri elenchi sono vuoti.
Nessun messaggio di errore.

## Perche' succede

L'accesso lo gestisce Firebase, i dati stanno su Supabase. Supabase accetta
il token di Firebase, ma per capire che chi sta chiedendo i dati e' una
persona autorizzata cerca dentro quel token un'informazione chiamata `role`,
che deve valere `authenticated`.

Firebase non la scrive da sola: va messa sull'account. E' scritto anche nel
pannello Supabase, sotto *Authentication > Third-Party Auth*:

> you'll need to add custom code to set the authenticated role to all your
> present and future users

Se quell'informazione manca, il token resta valido — infatti non compare
nessun errore — ma Supabase tratta la richiesta come se arrivasse da un
visitatore qualunque. E da quando l'archivio e' stato messo in sicurezza, un
visitatore qualunque non puo' leggere niente: Supabase risponde `200 OK` con
una lista vuota.

Da fuori sembra un magazzino vuoto. In realta' e' un magazzino a cui non
stiamo dicendo chi siamo.

## Come si risolve

### Subito, da terminale

Dalla cartella del progetto:

    node scripts/ripristina-ruolo-firebase.mjs

Mostra quali account non hanno il ruolo, senza toccare niente. Poi:

    node scripts/ripristina-ruolo-firebase.mjs --apply

Serve il file `firebase-service-account.json`, che e' gia' nella cartella.

Dopo averlo lanciato: esci dall'app e rientra. I token gia' emessi si
aggiornano da soli entro un'ora, ma uscire e rientrare e' immediato.

### Dall'app, in futuro

Nella console programmatore, sezione **Integrita**, c'e' il bottone
**Ripristina accessi**: fa la stessa cosa senza terminale.

Perche' funzioni online, su Cloudflare va aggiunta una variabile:

- nome: `FIREBASE_SERVICE_ACCOUNT`
- valore: il contenuto completo del file `firebase-service-account.json`

Senza quella variabile il bottone avvisa che le credenziali non ci sono; il
resto della console continua a funzionare.

## Come ci si accorge del problema

Nella diagnostica c'e' la riga **"Identita riconosciuta dal database"**.

- *OK* — Supabase sa chi sei, gli elenchi sono attendibili.
- *Errore* — sei trattato come visitatore anonimo: gli elenchi vuoti non
  vogliono dire che i dati non ci sono.

Il controllo funziona dopo aver eseguito la migration
`supabase/migrations/20260908_identita_sessione.sql`.

## Nuovi utenti

Chi viene creato dalla gestione utenti riceve ora il ruolo automaticamente.
Se la variabile `FIREBASE_SERVICE_ACCOUNT` non e' configurata, la creazione
riesce lo stesso ma l'app lo segnala, cosi' non si scopre il problema dalla
persona che chiama dicendo che non vede niente.

---

# Pubblicare il sito con un nome nuovo

Il nome `magazzino-pro` fa parte del progetto Cloudflare e non si puo'
rinominare: si crea un progetto nuovo e si pubblica li'.

    npx wrangler pages project create workspace --production-branch=main
    bash scripts/configura-cloudflare.sh workspace
    npm run build
    npx wrangler pages deploy dist --project-name=workspace --branch=main

Gli indirizzi `.pages.dev` sono unici in tutto il mondo, non solo nel tuo
account: se `workspace` risulta gia' preso, il primo comando lo dice e
basta ripetere i quattro passaggi con un altro nome (per esempio
`workspace-thermoservice`), tenendolo uguale in tutti e quattro.

Il secondo comando carica sul nuovo progetto le variabili che le funzioni
`/api/...` si aspettano di trovare. Senza, il sito si apre ma la console
programmatore e la gestione utenti non funzionano.

Se in futuro vuoi l'indirizzo esatto `workspace` senza il suffisso, la
strada e' un dominio tuo (Cloudflare > il progetto > Custom domains).

Il vecchio progetto va lasciato acceso finche' non hai verificato il nuovo,
poi si puo' eliminare dal pannello Cloudflare.
