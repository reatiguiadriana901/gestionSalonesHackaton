#!/bin/sh
# =====================================================================
#  Exporta los workflows editados en la interfaz de n8n hacia
#  backend/workflows/ (para guardarlos en git).
#
#  Uso (desde la raíz del proyecto, con los contenedores en marcha):
#    sh backend/scripts/exportar-workflows.sh
#
#  Conserva los nombres de archivo del repositorio: cada workflow exportado
#  reemplaza al archivo que tiene su mismo "id".
# =====================================================================
set -eu
cd "$(dirname "$0")/../.."

echo "Exportando workflows desde n8n…"
docker compose exec -T backend sh -c '
  rm -rf /tmp/exportados /tmp/salida && mkdir -p /tmp/salida
  n8n export:workflow --all --separate --output=/tmp/exportados >/dev/null
  node -e "
    const fs = require(\"fs\");
    const exportados = fs.readdirSync(\"/tmp/exportados\").map((f) => JSON.parse(fs.readFileSync(\"/tmp/exportados/\" + f, \"utf8\")));
    for (const archivo of fs.readdirSync(\"/opt/campus/workflows\")) {
      const original = JSON.parse(fs.readFileSync(\"/opt/campus/workflows/\" + archivo, \"utf8\"));
      const actual = exportados.find((w) => w.id === original.id);
      if (!actual) { console.log(\"  (sin cambios) \" + archivo); continue; }
      const limpio = {
        id: actual.id, name: actual.name, nodes: actual.nodes, connections: actual.connections,
        settings: actual.settings, active: false, pinData: {}, tags: (actual.tags || []).map((t) => ({ name: t.name })),
      };
      fs.writeFileSync(\"/tmp/salida/\" + archivo, JSON.stringify(limpio, null, 2) + \"\n\");
      console.log(\"  exportado     \" + archivo);
    }
  "
'
docker compose cp backend:/tmp/salida/. backend/workflows/
echo "Listo. Revisa los cambios con: git diff backend/workflows"
