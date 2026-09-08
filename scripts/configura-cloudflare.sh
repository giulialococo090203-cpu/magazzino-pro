#!/usr/bin/env bash
# ============================================================
# WorkSpace - VARIABILI DEL SITO SU CLOUDFLARE
# ------------------------------------------------------------
# Le pagine del sito sono statiche, ma le funzioni server
# (/api/...) hanno bisogno di sapere dove sta il database, quale
# email e' quella del programmatore e cosi' via. Su Cloudflare
# queste informazioni vanno caricate a parte: non viaggiano con
# il codice.
#
# Questo script le prende dai file che hai gia' sul computer
# (.dev.vars, .env e firebase-service-account.json) e le carica
# sul progetto indicato, senza che tu debba copiarle a mano.
#
# USO
#   bash scripts/configura-cloudflare.sh workspace
# ============================================================

set -euo pipefail

PROGETTO="${1:-}"

if [ -z "$PROGETTO" ]; then
  echo "Uso: bash scripts/configura-cloudflare.sh <nome-progetto>"
  exit 1
fi

leggi() {
  # leggi NOME file -> stampa il valore, ripulito da virgolette
  local nome="$1" file="$2"

  [ -f "$file" ] || return 0

  grep -m1 "^${nome}=" "$file" 2>/dev/null \
    | cut -d= -f2- \
    | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//'
}

carica() {
  local nome="$1" valore="$2"

  if [ -z "$valore" ]; then
    echo "  - $nome: non trovato, salto"
    return 0
  fi

  printf '%s' "$valore" \
    | npx wrangler pages secret put "$nome" --project-name="$PROGETTO" >/dev/null

  echo "  - $nome: caricata"
}

echo "Progetto: $PROGETTO"
echo "Variabili:"

for NOME in VITE_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY VITE_FIREBASE_API_KEY PROGRAMMER_EMAIL AZIENDA_ID; do
  carica "$NOME" "$(leggi "$NOME" .dev.vars)"
done

carica VITE_PDF_PARSER_URL "$(leggi VITE_PDF_PARSER_URL .env)"

if [ -f firebase-service-account.json ]; then
  carica FIREBASE_SERVICE_ACCOUNT "$(tr -d '\n' < firebase-service-account.json)"
else
  echo "  - FIREBASE_SERVICE_ACCOUNT: file non trovato, salto"
fi

echo
echo "Fatto. Ora rilancia il deploy perche' le funzioni le rileggano:"
echo "  npx wrangler pages deploy dist --project-name=$PROGETTO --branch=main"
