#!/bin/sh
# =====================================================================
#  Arranque del backend (n8n) · Campuslands
#
#  1. Genera las credenciales de n8n a partir de variables de entorno.
#  2. Importa los workflows de /opt/campus/workflows que cambiaron desde
#     el último arranque y los publica (así quedan activos sus webhooks).
#  3. Inicia n8n con el entrypoint original de la imagen oficial.
#
#  Variables útiles:
#    N8N_FORZAR_IMPORTACION=true  reimporta todos los workflows aunque no
#                                 hayan cambiado (descarta ediciones hechas
#                                 en la interfaz de n8n).
# =====================================================================
set -eu

DIR_WORKFLOWS=/opt/campus/workflows
DIR_ESTADO=/home/node/.n8n/campus-importados   # vive en el volumen de n8n

log() { echo "[campus] $*"; }

# --- 1. Credenciales ---------------------------------------------------
log "Configurando credenciales (proveedor de IA: ${AI_PROVIDER:-anthropic})"
ARCHIVO_CREDENCIALES=$(mktemp)
node /opt/campus/generar-credenciales.js > "$ARCHIVO_CREDENCIALES"
n8n import:credentials --input="$ARCHIVO_CREDENCIALES"
rm -f "$ARCHIVO_CREDENCIALES"

# --- 2. Workflows --------------------------------------------------------
mkdir -p "$DIR_ESTADO"
for archivo in "$DIR_WORKFLOWS"/*.json; do
  nombre=$(basename "$archivo")
  huella=$(sha256sum "$archivo" | cut -d ' ' -f 1)
  huella_previa=$(cat "$DIR_ESTADO/$nombre.sha256" 2>/dev/null || true)

  if [ "${N8N_FORZAR_IMPORTACION:-false}" != "true" ] && [ "$huella" = "$huella_previa" ]; then
    log "Sin cambios: $nombre"
    continue
  fi

  id=$(node -p 'require(process.argv[1]).id' "$archivo")
  log "Importando y publicando $nombre (id $id)"
  n8n import:workflow --input="$archivo"
  n8n publish:workflow --id="$id"
  echo "$huella" > "$DIR_ESTADO/$nombre.sha256"
done

# --- 3. n8n ----------------------------------------------------------------
log "Iniciando n8n"
exec /docker-entrypoint.sh "$@"
