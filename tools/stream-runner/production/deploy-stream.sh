#!/bin/bash
# Actualiza la carpeta de producción del directo (ChessPark-stream, al lado del repo) desde el repo de desarrollo.
#
#   bash tools/stream-runner/production/deploy-stream.sh                compila, copia y reinicia el directo
#   bash tools/stream-runner/production/deploy-stream.sh --no-restart   copia pero no reinicia (se aplica en el próximo reinicio)
#   bash tools/stream-runner/production/deploy-stream.sh --sync-music   fuerza copiar también la música
#   bash tools/stream-runner/production/deploy-stream.sh --app-ref main compila la app desde esa rama/commit, en una copia
#                                                                       limpia (no usa tus cambios ni tu rama actual)
#   bash tools/stream-runner/production/deploy-stream.sh --rollback     vuelve a la versión anterior de la app y reinicia
#
# Sin --app-ref se compila lo que hay en tu carpeta de trabajo (rama actual y cambios sin commitear): útil para
# probar, pero NO para producción. El runner y la música salen siempre de tu carpeta de trabajo.
# Reiniciar corta el directo unos segundos. La carpeta de producción es AUTÓNOMA: no depende de la rama ni de
# `dist` del repo, así que cambiar de rama o compilar allí no la toca. Solo este script la actualiza.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
SR="$REPO/tools/stream-runner"
PROD="${PROD_DIR:-$(dirname "$REPO")/ChessPark-stream}"
LABEL="com.chesscolate.live-stream"
KEEP_RELEASES=3
RESTART=1
ROLLBACK=0
SYNC_MUSIC=0
APP_REF=

die() { echo "✗ $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  arg="$1"; shift
  case "$arg" in
    --app-ref) [ $# -gt 0 ] || die "--app-ref necesita una rama o commit"; APP_REF="$1"; shift ;;
    --app-ref=*) APP_REF="${arg#--app-ref=}" ;;
    --no-restart) RESTART=0 ;;
    --rollback) ROLLBACK=1 ;;
    --sync-music) SYNC_MUSIC=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "Opción desconocida: $arg (usa --help)" ;;
  esac
done

restart_service() {
  if [ "$RESTART" = 1 ] && launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
    echo "▸ Reiniciando el directo (corte de unos segundos)…"
    launchctl kickstart -k "gui/$(id -u)/$LABEL"
  else
    echo "▸ El directo no se reinició (LaunchAgent no cargado, o pediste --no-restart)."
    echo "  La versión nueva se usará en el próximo arranque."
  fi
}

current_release() { basename "$(readlink "$PROD/app" 2>/dev/null || true)"; }

if [ "$ROLLBACK" = 1 ]; then
  [ -d "$PROD/releases" ] || die "No hay versiones guardadas en $PROD/releases"
  CURRENT="$(current_release)"
  PREVIOUS="$(ls -1 "$PROD/releases" | sort -r | grep -vx "$CURRENT" | head -1 || true)"
  [ -n "$PREVIOUS" ] || die "No hay una versión anterior a la actual ($CURRENT)"
  ln -sfn "releases/$PREVIOUS" "$PROD/app"
  echo "✓ App devuelta a la versión $PREVIOUS (era $CURRENT)"
  restart_service
  exit 0
fi

command -v rsync >/dev/null || die "Falta rsync"
command -v npx >/dev/null || die "Falta npx (¿está activo el Node correcto?)"
[ -d "$SR" ] || die "No encuentro $SR"

echo "▸ Repo:        $REPO"
echo "▸ Producción:  $PROD"

BUILD_ROOT="$REPO"
APP_COMMIT=""
if [ -n "$APP_REF" ]; then
  APP_COMMIT="$(git -C "$REPO" rev-parse --verify --short "$APP_REF^{commit}" 2>/dev/null)" || die "No existe la rama o commit «$APP_REF»"
  BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/live-build-XXXXXX")"
  trap 'git -C "$REPO" worktree remove --force "$BUILD_ROOT" >/dev/null 2>&1 || rm -rf "$BUILD_ROOT"' EXIT
  git -C "$REPO" worktree add --detach "$BUILD_ROOT" "$APP_COMMIT" >/dev/null
  ln -s "$REPO/node_modules" "$BUILD_ROOT/node_modules"
  echo "▸ Compilando la app desde «$APP_REF» ($APP_COMMIT) en una copia limpia…"
else
  echo "▸ Compilando la app desde tu carpeta de trabajo (rama $(git -C "$REPO" rev-parse --abbrev-ref HEAD))…"
  [ -z "$(git -C "$REPO" status --porcelain -- apps/live-stream libs)" ] || echo "⚠ Hay cambios sin commitear en apps/live-stream o libs: irán a producción. Usa --app-ref main para evitarlo."
fi
(cd "$BUILD_ROOT" && npx nx build live-stream)
SRC="$BUILD_ROOT/dist/apps/live-stream/browser"
[ -f "$SRC/index.html" ] || die "La compilación no dejó $SRC/index.html"

ID="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PROD/releases" "$PROD/runner/lib" "$PROD/runner/music"
rsync -a --delete "$SRC/" "$PROD/releases/$ID/"
echo "✓ App copiada a releases/$ID"

echo "▸ Copiando el runner…"
cp "$SR/run-stream.mjs" "$SR/start-live.mjs" "$PROD/runner/"
rsync -a --delete "$SR/lib/" "$PROD/runner/lib/"
if ! cmp -s "$SR/production/package.json" "$PROD/runner/package.json" || [ ! -d "$PROD/runner/node_modules/puppeteer-core" ]; then
  cp "$SR/production/package.json" "$PROD/runner/package.json"
  echo "▸ Instalando dependencias del runner (puppeteer-core)…"
  (cd "$PROD/runner" && npm install --omit=dev --no-audit --no-fund --loglevel=error)
fi

if [ -f "$SR/music/playlist.json" ]; then
  if [ "$SYNC_MUSIC" = 1 ] || ! cmp -s "$SR/music/playlist.json" "$PROD/runner/music/playlist.json" || [ ! -d "$PROD/runner/music/normalized" ]; then
    [ -d "$SR/music/normalized" ] || die "Falta $SR/music/normalized (corre prepare-music.mjs)"
    echo "▸ Copiando la música (puede tardar la primera vez)…"
    rsync -a --delete "$SR/music/normalized/" "$PROD/runner/music/normalized/"
    cp "$SR/music/playlist.json" "$PROD/runner/music/playlist.json"
  fi
else
  die "Falta $SR/music/playlist.json"
fi

if [ -n "$APP_REF" ]; then
  APP_DESC="app de $APP_REF ($APP_COMMIT)"
else
  DIRTY=""
  [ -n "$(git -C "$REPO" status --porcelain -- apps/live-stream libs)" ] && DIRTY=", con cambios sin commitear"
  APP_DESC="app de la carpeta de trabajo ($(git -C "$REPO" rev-parse --abbrev-ref HEAD) $(git -C "$REPO" rev-parse --short HEAD)$DIRTY)"
fi
echo "$APP_DESC · runner $(git -C "$REPO" rev-parse --short HEAD) · compilado $(date '+%F %T')" > "$PROD/VERSION"

# El cambio de versión es lo último: hasta aquí el directo sigue sirviendo la anterior.
ln -sfn "releases/$ID" "$PROD/app"
ls -1 "$PROD/releases" | sort -r | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do rm -rf "$PROD/releases/$old"; done

echo "✓ Producción actualizada: $(cat "$PROD/VERSION")"
restart_service
