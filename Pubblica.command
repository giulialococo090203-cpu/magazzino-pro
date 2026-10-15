#!/bin/bash
# ============================================================
# PUBBLICA WORKSPACE ONLINE
# Doppio clic su questo file dal Finder: prepara il sito,
# lo pubblica su Cloudflare (magazzino-pro.pages.dev) e salva
# le modifiche su GitHub. Non serve tenere aperto VS Code.
# ============================================================

cd "$(dirname "$0")" || exit 1

# File temporaneo lasciato da Claude durante i controlli.
rm -f .tmp-claude-repo.tgz

pausa() {
  echo
  read -r -p "Premi Invio per chiudere questa finestra..." _
}

echo "1/4  Controllo librerie..."
if [ ! -d node_modules ]; then
  npm install || { echo "ERRORE: installazione librerie non riuscita."; pausa; exit 1; }
fi

echo "2/4  Preparazione del sito (build)..."
if ! npm run build; then
  echo
  echo "ERRORE: la build non e' riuscita. Il sito online NON e' stato toccato."
  echo "Copia il testo qui sopra e mandalo a Claude."
  pausa
  exit 1
fi

echo
echo "Dimensione dei file principali:"
ls -lhS dist/assets | head -8

echo
echo "3/4  Pubblicazione su Cloudflare..."
if ! npx wrangler pages deploy dist --project-name=magazzino-pro --branch=main --commit-dirty=true; then
  echo
  echo "Pubblicazione non riuscita. Se chiede l'accesso, lancia una volta:"
  echo "   npx wrangler login"
  echo "e poi fai di nuovo doppio clic su Pubblica.command."
  pausa
  exit 1
fi

echo
echo "4/4  Salvataggio su GitHub..."
git add index.html public/_headers src Pubblica.command
if ! git diff --cached --quiet; then
  git commit -m "Avvio piu' veloce e senza schermo bianco: pagine caricate su richiesta, controlli in background, protezione dagli errori"
fi
git push || echo "Push su GitHub non riuscito (il sito online e' comunque aggiornato)."

echo
echo "FATTO. Apri https://magazzino-pro.pages.dev"
echo "(se vedi ancora la versione vecchia: Cmd+Maiusc+R)"
pausa
