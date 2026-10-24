#!/bin/bash
# Instala el LaunchAgent que arranca el directo de producción al iniciar sesión y lo relanza si se cae.
# ¡Empieza a EMITIR a YouTube en cuanto se carga! Antes: la app desplegada, la clave en el llavero y el
# directo de YouTube listo.
#
#   bash tools/stream-runner/production/install-launchagent.sh
#   PROD_DIR=/otra/ruta KEY_SERVICE=otro-servicio bash …
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
PROD="${PROD_DIR:-$(dirname "$REPO")/ChessPark-stream}"
KEY_SERVICE="${KEY_SERVICE:-chesscolate-youtube-prod}"
LABEL="com.chesscolate.live-stream"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGS="$HOME/Library/Logs/chesscolate-live"

die() { echo "✗ $*" >&2; exit 1; }

[ -f "$PROD/app/index.html" ] || die "No hay app en $PROD/app. Corre primero deploy-stream.sh"
[ -f "$PROD/runner/start-live.mjs" ] || die "No hay runner en $PROD/runner. Corre primero deploy-stream.sh"
[ -d "$PROD/runner/node_modules/puppeteer-core" ] || die "Faltan las dependencias del runner. Corre deploy-stream.sh"
[ -f "$PROD/runner/music/playlist.json" ] || die "Falta la música en $PROD/runner/music"
[ -x /opt/homebrew/bin/ffmpeg ] || die "Falta ffmpeg en /opt/homebrew/bin (brew install ffmpeg)"
[ -d "/Applications/Google Chrome.app" ] || die "Falta Google Chrome en /Applications"
security find-generic-password -a "$USER" -s "$KEY_SERVICE" >/dev/null 2>&1 \
  || die "No hay clave en el llavero (servicio «$KEY_SERVICE»). Guárdala con:  security add-generic-password -a \"\$USER\" -s $KEY_SERVICE -w"

NODE="$(command -v node)" || die "No encuentro node"
NODE="$(cd "$(dirname "$NODE")" && pwd -P)/$(basename "$NODE")"

if ! defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser >/dev/null 2>&1; then
  echo "⚠ El inicio de sesión automático NO está activado. Tras un reinicio o un corte de luz, el directo no"
  echo "  volverá hasta que alguien inicie sesión. (Ajustes del Sistema → Usuarios y grupos → Iniciar sesión automáticamente)"
fi

echo "Se instalará $PLIST"
echo "  node:       $NODE"
echo "  producción: $PROD   ($(cat "$PROD/VERSION" 2>/dev/null || echo 'sin VERSION'))"
echo "  clave:      llavero, servicio «$KEY_SERVICE»"
echo "Y el directo EMPEZARÁ A EMITIR a YouTube ahora mismo."
read -r -p "Escribe SI para continuar: " answer
[ "$answer" = "SI" ] || die "Cancelado"

mkdir -p "$HOME/Library/LaunchAgents" "$LOGS"
sed -e "s#{{NODE}}#$NODE#g" -e "s#{{PROD}}#$PROD#g" -e "s#{{HOME}}#$HOME#g" \
  "$REPO/tools/stream-runner/production/com.chesscolate.live-stream.plist.template" > "$PLIST"
plutil -lint "$PLIST" >/dev/null || die "El .plist generado no es válido"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "✓ Instalado y en marcha. Registro: $LOGS/stream.log"
echo "  Estado:  launchctl print gui/$(id -u)/$LABEL | head"
echo "  Parar:   bash $REPO/tools/stream-runner/production/uninstall-launchagent.sh"
