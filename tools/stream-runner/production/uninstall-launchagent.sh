#!/bin/bash
# Detiene el directo de producción y quita el LaunchAgent (no borra la carpeta de producción ni los registros).
set -euo pipefail
LABEL="com.chesscolate.live-stream"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 && echo "✓ Directo detenido" || echo "· No estaba cargado"
rm -f "$PLIST" && echo "✓ LaunchAgent quitado"
