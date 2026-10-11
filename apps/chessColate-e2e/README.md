# ChessColate · E2E (Playwright)

Proyecto aparte de `apps/chessColate`. Abre la app compilada en un navegador de
móvil (393×852) y verifica que cada pantalla abre, que sus flujos funcionan y que
se ve igual que la captura de referencia. Es la red de seguridad de los refactors.

```bash
# Primera vez, o tras cambiar código de la app (recompila):
E2E_REBUILD=1 npx playwright test -c apps/chessColate-e2e/playwright.config.ts

npx playwright test -c apps/chessColate-e2e/playwright.config.ts            # corre la suite
npx playwright test -c apps/chessColate-e2e/playwright.config.ts --ui       # interactivo
npx playwright test -c apps/chessColate-e2e/playwright.config.ts --headed   # navegador visible
npx nx e2e chessColate-e2e                                                  # vía Nx
```

Requiere `apps/chessColate/src/environments/private/keys.ts` (ignorado por git) para
compilar. Esas claves **no se usan en las pruebas**: la red está cortada.

## Cómo está armado

| Pieza | Para qué |
|---|---|
| `support/serve.mjs` | Compila la app una vez y la sirve estática en el puerto 4310 (sin watch) |
| `support/network.ts` | Corta TODA la red externa. Solo responden la app y el CDN de puzzles (datos fijos). Lo demás se aborta y se anota |
| `support/fixtures.ts` | Puzzles reales con jugadas validadas con chess.js |
| `support/test.ts` | `test` extendido: red cortada, fecha fija, `Math.random` con semilla, onboarding ya visto |
| `support/rut-helpers.ts` | Rutinas: esperar puzzle, mover piezas, adelantar el reloj del bloque |
| `support/resto-*.ts` | Tablero, reloj acelerado, IndexedDB, partidas simuladas; `resto-test.ts` reexporta `test`/`expect` con 15 s |
| `specs/` | Las pruebas, una por funcionalidad |
| `snapshots/` | Capturas de referencia (se versionan) |

Determinismo: fecha fija (2026-10-10 12:00 UTC), zona UTC, aleatoriedad con semilla y
animaciones desactivadas. Una captura que cambia entre corridas es un bug de la prueba.

## Correr varias veces a la vez

`reuseExistingServer` hace que quien arranca el servidor lo apague al terminar. Si dos
corridas comparten el puerto, una se queda sin servidor. En paralelo, da a cada una el suyo:
`E2E_PORT=4377 npx playwright test -c apps/chessColate-e2e/playwright.config.ts`.

Los specs de rutinas leen el puzzle en pantalla con `window.ng.getComponent`: requieren la
build de **desarrollo** (la que compila `serve.mjs`).

## Capturas de referencia

Una prueba falla si la pantalla cambia (`maxDiffPixelRatio` 0,2 %). Si el cambio es
**intencional** (se rediseñó algo), regenera y revisa el diff en el commit:

```bash
npx playwright test -c apps/chessColate-e2e/playwright.config.ts --update-snapshots
```

Cuando una prueba falla, Playwright deja `actual`, `expected` y `diff` en
`dist/.playwright/apps/chessColate-e2e/test-output/`.

## Qué NO se puede probar aquí

- **Sesión iniciada:** requeriría simular Firebase Auth y Firestore. Las pruebas
  cubren el modo invitado y que los guards redirijan.
- **Funciones nativas** (notificaciones locales, compras, in-app review): en web la
  pantalla de Recordatorios solo avisa de que funciona en la app móvil.
