# Informe de Deuda Técnica — ChessPark

> **Fecha:** 2026-07-02 · **Última actualización:** 2026-10-07
> **Rama analizada:** `feat/chesscolate-ux-onboarding` (base) + `main` (actualización)
> **Stack:** Nx 21 · Angular 20 (standalone) · Ionic 8 · Capacitor 7 · NgRx clásico · Firebase/Firestore · RevenueCat
> **Alcance:** código activo (`apps/chessColate`, `apps/chess-extension`, `libs/*`). `apps/Chesscolate-old` queda **fuera de alcance**: es legacy congelado que se conserva deliberadamente como referencia de migración (ver [MIGRACION_CHESSCOLATE.md](./MIGRACION_CHESSCOLATE.md)).

---

## ✅ Avances al 2026-10-07

Desde la actualización del 2026-10-01 se abordaron los hallazgos P0.1, P0.2 y P0.3 y varios quick wins. **Las referencias `archivo:línea` de P0.1–P0.3 corresponden al código previo a estos cambios** y ya no coinciden. Cada hallazgo afectado lleva abajo un bloque **Estado 2026-10-07**.

| Hallazgo | Estado | Resumen |
|---|---|---|
| P0.1 God-services | ✅ Resuelto | `generateBlocksForPlan` es un despachador con tabla de planes; `firestore.service.ts` se partió en repositorios por agregado |
| P0.2 God-components | 🟡 Parcial | Stockfish y el motor de puzzle salieron de `libs/board`; en `training` se extrajo sesión, cronómetro y utils, pero el componente no se achicó |
| P0.3 Bypass de facades | ✅ Resuelto | Componentes leen por el store; regla de lint impide inyectar repositorios en `pages/` y `shared/` |
| P0.4 Sin CI | ⏳ Abierto | No se abordó (se dejó fuera a propósito) |
| P1.1 Lógica de tablero duplicada | 🟡 Parcial | Construcción del tablero, manejador de movimientos y utilidades de marcadores compartidos; queda el parseo de la solución |
| P1.4 Dependencias | 🟡 Parcial | Quitadas 3 dependencias muertas; `@capacitor/cli`, `@nx/angular` y `@ionic` alineados; falta `prettier` y la convención del lock |
| P1.8 `libs/widgets` | ✅ Resuelto | Lib eliminada junto a sus dos alias de `tsconfig` |
| P1.6 Límites de módulo | 🟡 Parcial | Scope `@chesspark/*` unificado; faltan tags y `depConstraints` |
| P2.3 Tests | 🟡 Mejorado | App de 9 a 28 specs (323 tests); `libs/state` tiene 11 de 12 suites sin compilar |
| P2.5 Logging | 🟡 Parcial | Se quitaron los `console.log` que volcaban el plan |
| P2.6 PGN personal | 🟡 Parcial | Fuera del árbol y en `.gitignore`, pero sigue en el historial de git |

**Hallazgos nuevos de esta pasada:**
- `@capacitor/cli` estaba instalado en **6.2.1** junto a `core`, `android` e `ios` en 7.6.x: `npx cap sync` corría con un CLI una versión mayor atrás. Corregido en `package.json` y el lock; **`node_modules` no se actualiza hasta ejecutar `npm install`**.
- `@nx/angular` estaba en 22.5.1 con el resto de Nx en 21.2.1, y traía **su propia copia de Nx 22.5.1** anidada en `node_modules`: convivían dos Nx. Tres libs compilan con su executor (`ng-packagr-lite`).
- Con `@nx/angular` 21.2.1, `"composite": true` en el `tsconfig.lib.json` de esas tres libs rompe su build (`TS6307`, por los archivos `.ngtypecheck.ts` que genera el compilador de Angular). Se quitó; compilan con ambas versiones.
- Siguen existiendo copias de `nx@21.6.10` anidadas bajo `@nx/plugin` y `@nxext/stencil` (mismo major, distinto menor que el 21.2.1 del resto).
- El lock se genera de forma inconsistente: el informe asume `npm ci --legacy-peer-deps`, pero un `npm install` sin esa bandera añade al lock ~75 paquetes peer (storybook, vitest, react…) que no están en `package.json`.
- Los specs de `plan` y `plansElos` en `libs/state` se escribieron contra la forma de un estado generado y nunca se actualizaron (errores de tipos), por lo que 11 de las 12 suites de la lib no compilan.

---

## ⚠️ Cambios desde la versión del 2026-07-02

- **El CI fue eliminado, no solo le faltaba un gate.** El commit `db1e7ae` (2026-07-14, *"chore(ci): deshabilitar workflows de CI y deploy automatico"*) borró `.github/workflows/ci.yml` y `firebase-deploy.yml` por completo ("no se quieren deploys automaticos y las pruebas aun no estan bien configuradas"). El hallazgo **P0.4** de este documento, redactado 12 días antes, asumía que el CI seguía corriendo lint/test/build — ya no es así. Ver P0.4 actualizado abajo.
- Esta actualización añade una pasada específica sobre `libs/*` y `apps/chess-extension`, que la versión original cubría de forma más superficial (nuevos hallazgos: P1.6, P1.7, P1.8).
- `training.component.ts` creció de 953 a **1110 líneas** desde julio — el god-component de P0.2 sigue sin atacarse y sigue creciendo. *(Actualización 2026-10-07: ya se atacó; ver el estado de P0.2.)*

---

## 1. Resumen ejecutivo

El código activo está en buena forma arquitectónica de base (Angular standalone, lazy loading, libs Nx, `strict` por proyecto, NgRx con facades). La deuda se concentra en **cinco focos**:

1. **God-objects**: un método de ~700 líneas y varios servicios/componentes de 850–1110 líneas que mezclan dominio, persistencia y UI.
2. **Duplicación de lógica de tablero y de providers**: en `libs/board` (el propio código lo documenta con comentarios) y entre `chess-com-provider`/`lichess-provider`.
3. **Bypass de la capa de datos**: componentes que llaman a Firestore directamente, saltándose los facades existentes.
4. **Red de seguridad inexistente**: cobertura de tests real ~10-15 %, e2e no-op, **y CI eliminado por completo** (ya no hay ni siquiera el gate débil que había en julio).
5. **Límites de módulo sin aplicar**: la regla de Nx `enforce-module-boundaries` está configurada de forma que no restringe nada entre libs, y conviven dos scopes de paquete (`@chesspark/*` y `@cpark/*`).

Al 2026-10-07 los focos 1 y 3 están en gran parte resueltos (ver «Avances»); siguen abiertos el 2, el 4 y el 5.

Ninguno bloquea el desarrollo hoy, pero elevan el coste de cada cambio y el riesgo de regresión.

### Panorama cuantitativo (solo código activo)

| Métrica | Valor |
|---|---|
| Archivos `.ts` (sin spec) | 327 (incluye legacy) |
| LOC app activa (`chessColate`) | ~18.6k |
| LOC `chess-extension` | ~1.8k |
| LOC libs | ~12.4k |
| `console.*` en producción | 234 |
| `any` explícitos | 124 |
| Specs con ≤1 caso (`should create`) | 78 % del total |
| Cobertura real estimada | ~10-15 % (concentrada en libs) |

### Nota sobre `Chesscolate-old`

Se **mantiene como referencia** y no debe contarse como deuda del código activo. Consideraciones para que siga siendo útil y no estorbe:

- No es proyecto Nx (sin `project.json`), por lo que ya está excluida de build, `nx affected`, lint, test y deploy. Correcto.
- No importa ninguna lib ni la importa nadie: está aislada y no puede romper el código activo.
- **Recomendación ligera:** dejar constancia explícita de su carácter de referencia (una nota en su cabecera o en `MIGRACION_CHESSCOLATE.md`) para que futuros lectores no la confundan con código vivo ni intenten "arreglar" su deuda.

---

## 2. Hallazgos por prioridad

Prioridad = impacto × frecuencia de cambio × riesgo. Cada hallazgo incluye referencias `archivo:línea`.

### 🔴 P0 — Alto impacto, abordar pronto

#### P0.1 — God-services y un método de ~700 líneas

> **Estado 2026-10-07 — ✅ Resuelto** (`af5e993`, `296ebd6`).
> - `generateBlocksForPlan` es ahora un despachador corto; la configuración de cada plan vive en una tabla (`services/plans/plan-blocks.config.ts`, 388 líneas). `block.service.ts` pasó de 866 a 436 líneas y tiene 26 tests de caracterización.
> - `firestore.service.ts` (915 líneas) se eliminó. Hay un repositorio por agregado en `services/firestore/`: `profile`, `user-puzzle`, `plan`, `plan-elos`, `custom-plan`, `public-plan` y `plan-interaction`, más `firestore-connection` y `firestore-serialize`. El mayor que queda es `public-plan.repository.ts` (347 líneas).
> - Los ELO de partida de cada modo se dejaron separados a propósito y documentados como constantes: 1500 en los planes de la tabla, `RETO333_START_ELO` en el Reto 333 y 800–1000 en `backToCalm`. El ELO del bloque de enfriamiento de `plan30` se lee ahora del mismo tema que se muestra.

- `apps/chessColate/src/app/services/block.service.ts:68-767` — `generateBlocksForPlan()` es **un único método de ~700 líneas** con ramas copy-paste casi idénticas por tamaño de plan (plan3/5/10/20/30), cada una repitiendo `getRandomTheme` / `getWeaknessInPlan` (`:172, :217, :274, :372, :535`). Complejidad ciclomática muy alta, imposible de testear por unidad. Mezcla generación de bloques, selección de temas/aperturas, cálculo de debilidades y consulta de puzzles.
- `apps/chessColate/src/app/services/firestore.service.ts` (915 líneas) — repositorio monolítico con ~30 métodos públicos: perfiles, nicknames, coordinates, user puzzles, planes, plan-elos, custom plans, public plans, interacciones y stats.

**Acción sugerida:**
- Descomponer `generateBlocksForPlan` en una estrategia parametrizada por configuración de plan (tabla de tamaños) en lugar de ramas duplicadas.
- Partir `firestore.service.ts` por agregado: `ProfileRepository`, `PlanRepository`, `PublicPlanRepository`, `InteractionRepository`.

#### P0.2 — Componentes God-object con lógica de dominio incrustada

> **Estado 2026-10-07 — 🟡 Parcial** (`af5e993`, `b2bdec7`, `296ebd6`).
> - **`libs/board` ✅:** el ciclo de vida de Stockfish salió de `board-puzzle-solution.component.ts` a `StockfishEngineFacade` (`libs/board/src/lib/stockfish-engine/`), que además garantiza que gane la última posición pedida. La validación de movimientos, promoción, hints y avance de solución de `board-puzzle.component.ts` salió a `PuzzleEngine`. Los componentes pasaron de 917 a 798 y de 871 a 772 líneas; lo que queda es UI y timers (ver P2.1).
> - **`training.component.ts` 🟡:** se extrajeron `TrainingSessionService` (flujo de bloques), `TrainingTimerService` (cronómetro) y utils puras (`block-presentation`, `training-analytics`, `player-color`, además de las de ELO y Reto 333), con 58 tests. **El componente no se achicó** (1113 → 1111 líneas): los getters que delegan en los servicios y su documentación ocupan lo que ocupaban los campos. Para bajarlo hay que eliminar esos getters y que la plantilla use los servicios directamente.
> - Los `console.log('Plan ', …)` que volcaban el plan ya no existen.

- `apps/chessColate/src/app/pages/puzzles/containers/training/training.component.ts:76` (953 líneas): cálculo de ELO por tipo de plan (`saveInitialMaxElo` `:221-255`), **persistencia directa a `localStorage`** con `JSON.parse`/`try-catch` inline (`showReto333Alert` `:656-715`), parseo de FEN en un getter (`playerColor` `:122-135`), y `onPuzzleCompleted` `:515-627` que mezcla dominio, sonidos y UI.
- `libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts:54` (917 líneas): un componente de UI gestiona **todo el ciclo de vida de Stockfish** (init/terminate/reintentos/errores de worker) `:116-281`.
- `libs/board/src/lib/board-puzzle/board-puzzle.component.ts:90` (871 líneas): motor de puzzle completo (validación, promoción, timers, hints) dentro del componente.

**Acción sugerida:** mover ELO/reto333/persistencia a servicios de dominio; encapsular Stockfish en un facade que exponga "analiza esta posición" y oculte el ciclo de vida del worker.

#### P0.3 — Componentes que acceden a Firestore saltándose los facades

> **Estado 2026-10-07 — ✅ Resuelto** (`af5e993`).
> - `public-plans` y `plan-played` leen por el store: `libs/state/public-plans` ganó acciones, efectos y selectores para las interacciones.
> - Ningún archivo bajo `pages/` ni `shared/` inyecta repositorios de Firestore, y una regla de lint (`no-restricted-imports` en `apps/chessColate/eslint.config.mjs`) lo impide.
> - Excepción deliberada: `CustomPlansService` escribe en Firestore con `await` y luego actualiza el store, para que un error llegue al formulario que guarda. Pasarlo a efectos del store cambiaría ese comportamiento sin beneficio visible.

Existe infraestructura de facades (`plan-facade.service.ts`, `public-plans-facade.service.ts`) pero varios componentes la eluden, creando **dos caminos de datos** (Store vs Firestore directo):

- `apps/chessColate/src/app/pages/puzzles/containers/public-plans/public-plans.component.ts:113, :139, :165` — `getPublicPlan()` directo.
- `apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts:231` — `getPlanInteraction()` directo.
- Ya reconocido en el código: `// TODO: no llamar directamente a firestore, pasar por el facade o store` en `apps/chessColate/src/app/services/custom-plans.service.ts:38`.

**Acción sugerida:** exponer estos accesos a través de los facades/Store y prohibir la inyección de `FirestoreService` en componentes (regla de lint de arquitectura).

#### P0.4 — Sin CI: el deploy y los merges no tienen ninguna red de seguridad automática

> **Estado 2026-10-07 — ⏳ Abierto.** No se abordó en esta tanda por decisión explícita.

> **Actualizado 2026-10-01** — este hallazgo cambió de naturaleza desde julio: ya no es "al CI le falta un gate", es que **el CI no existe**.

- El commit `db1e7ae` (2026-07-14, *"chore(ci): deshabilitar workflows de CI y deploy automatico"*) eliminó `.github/workflows/ci.yml` (que corría `nx affected -t lint test build e2e`) y `.github/workflows/firebase-deploy.yml` por completo. El mensaje del commit explica la motivación: *"No se quieren deploys automaticos y las pruebas aun no estan bien configuradas"*.
- Hoy `.github/` solo contiene `instructions/`. No hay ningún workflow de GitHub Actions en el repo.
- Nada impide mergear a `main` código que no compila, no pasa lint o rompe tests — el único control es disciplina manual. El deploy es 100 % manual (`npm run build:chessColate` + `npm run deploy:chessColate` / `firebase deploy`), sin gate previo.

**Acción sugerida:** reintroducir un workflow de **solo verificación** (`nx affected -t lint test build` en cada PR) sin acoplarlo a deploy automático — esto respeta la decisión explícita de no auto-desplegar, mientras recupera la red de seguridad mínima de "no mergear código roto". Una vez que la suite de tests esté en mejor forma (ver P2.3), evaluar si vale la pena reintroducir `e2e` y/o un deploy gateado por CI verde.

---

### 🟠 P1 — Duplicación y consistencia

#### P1.1 — Duplicación de lógica de tablero en `libs/board`

> **Estado 2026-10-07 — 🟡 Parcial.**
> - ✅ **Construcción del tablero:** `createChessboard` / `buildChessboardConfig` (`libs/board/src/lib/chessboard-factory/`) concentran la configuración común (assets, estilo, piezas, modo responsive). Lo usan `board-puzzle`, `board-puzzle-solution`, `fen-board`, `board-game-player` y `board-heatmap`, y hay tests que fijan que cada uno recibe la misma configuración que construía antes. `board` y `chess960-board` quedan fuera: reciben su configuración por `@Input`. *(El conteo de «5 archivos» del hallazgo ya era 6 antes de este cambio, porque aparecieron `board-heatmap` y `board-game-player`.)*
> - ✅ **Manejador de movimientos:** el flujo de `enableMoveInput` (casillas posibles, aceptar o rechazar la jugada, diálogo de promoción) vive ahora una sola vez en `createMoveInputHandler` (`libs/board/src/lib/move-input/`). Cada componente solo indica con qué motor de ajedrez consulta y qué hace al aceptar una jugada. `removeMarkerNotLastMove`, `turnRoundBoard` y el dibujo de la última jugada (`showLastMove`) son ahora utilidades compartidas (`board-markers.ts`), y la detección de coronación (`isPromotionAttempt`) es una sola función.
> - ✅ **Red de seguridad:** `move-input-behavior.spec.ts` (26 tests) ejecuta los mismos escenarios contra `BoardPuzzleComponent` y `BoardPuzzleSolutionComponent` y fija la secuencia exacta de llamadas al tablero. Se escribió y pasó contra el código original antes de refactorizar; confirmó además que los dos manejadores ya se comportaban igual.
> - ⏳ **Lo que sigue duplicado:** la construcción de la solución (`getMoves` en `board-puzzle-solution` frente a `PuzzleEngine.load`) y `puzzleMoveResponse`, que difieren de verdad entre los dos.
> - ℹ️ **Decisión:** el informe proponía migrar `board-puzzle-solution` al `PuzzleEngine`; **no se hizo porque no encaja**. El motor modela *resolver* un puzzle contra las respuestas de la máquina; el componente de solución es un visor que navega una lista de posiciones (atrás, adelante, inicio, fin, reproducción automática, pista y modo libre al terminar). Forzarlo habría exigido añadir al motor navegación y movimientos libres, sin quitar duplicación real.

El handler `enableMoveInput` (~120 líneas, incl. bloque de promoción de peón) está **duplicado casi literal** entre:
- `libs/board/src/lib/board-puzzle/board-puzzle.component.ts:303-455`
- `libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts:440-566`

El propio código lo admite: `// Aplicar correcciones de board-puzzle.component.ts para promoción...` (`board-puzzle-solution.component.ts:463`).

También duplicados: `showLastMove`, `removeMarkerNotLastMove`, `turnRoundBoard`, `puzzleMoveResponse`, y el parseo de solución `getMoves`/`initPuzzle`. La construcción de `new Chessboard(...)` (mismos `assetsUrl`, `BORDER_TYPE`, extensiones Markers/Arrows/PromotionDialog) se repite en **5 archivos**: board, board-puzzle, board-puzzle-solution, fen-board, chess960-board.

**Acción sugerida:** una factory `createChessboard(config)` + un servicio/mixin de manejo de movimientos y marcadores en `libs/board`.

#### P1.2 — Lógica de negocio de temas/debilidades dispersa

> **Estado 2026-10-07 — ⏳ Abierto.** `getRandomTheme` sigue duplicado: una versión pública en `block.service.ts` y otra privada en `puzzles-provider.ts`, con fuentes de temas distintas.

- `getRandomTheme` tiene **dos implementaciones divergentes**: `block.service.ts:767` (usa `appService.getThemesPuzzlesList`) vs `libs/puzzles-provider/src/lib/puzzles-provider.ts:260` (usa `getManifestThemes()`). Dos fuentes de verdad que pueden devolver conjuntos distintos.
- Selección de debilidad/fortaleza re-implementada en 3 servicios: `plans-elos.service.ts:151/164`, `block.service.ts:789/815/841`, `plan.service.ts:44-47`.

**Acción sugerida:** consolidar en un único `ThemeSelectionService` con una sola fuente de temas.

#### P1.3 — Doble fuente de estado (Store + campo mutable)

> **Estado 2026-10-07 — ⏳ Abierto.** `profile.service.ts:65` sigue suscribiéndose al perfil en el constructor.

- `apps/chessColate/src/app/services/profile.service.ts:51-63` mantiene `this.profile` sincronizado manualmente desde el Store mediante un `subscribe()` en el constructor **sin teardown**. El perfil vive en dos lugares (Store y campo del servicio). Antipatrón aunque el servicio sea singleton.

#### P1.4 — Dependencias declaradas pero no usadas / en conflicto

> **Estado 2026-10-07 — 🟡 Parcial.**
> - ✅ Se quitaron `@lichess-org/chessground`, `@ngrx/signals` y `@ngrx/component-store` (0 usos en código activo; solo figuraban en el `package.json` de `Chesscolate-old`).
> - ✅ `@capacitor/cli` quedó en `^7.4.2` y se eliminaron los duplicados de `@capacitor/android|core|ios` en `devDependencies`. **Hasta ejecutar `npm install`, `node_modules` sigue con el CLI 6.2.1.**
> - ✅ `@nx/angular` bajó a 21.2.1 y coincide con el resto de Nx: desaparece la segunda copia de Nx que traía anidada. Verificado en una instalación limpia aislada (build de los 13 proyectos y tests con las mismas cifras de antes). Requirió quitar `"composite": true` del `tsconfig.lib.json` de `stockfish-wasm`, `common-utils` y `revenuecat`, que compilan tanto con la 21.2.1 como con la 22.5.1.
> - ✅ `@ionic/angular` y `@ionic/angular-toolkit` quedan solo en `dependencies` (con el rango más exigente de los dos).
> - ⏳ Siguen: `prettier ^2.6.2` (la v3 cambia los valores por defecto de formato, así que se deja para decidirlo aparte) y las copias de `nx@21.6.10` bajo `@nx/plugin` y `@nxext/stencil`.
> - ⏳ Convención del lock: hay que decidir si se genera siempre con `--legacy-peer-deps` (como asume el informe) o sin ella; hoy se alterna y el lock sin commitear arrastra ~75 paquetes peer.

- `@lichess-org/chessground ^9.3.1` — **0 usos**; todo el código usa `cm-chessboard`. Peso muerto.
- `libs/widgets` (`@cpark/widgets`) — **no la importa nadie**; lib huérfana.
- `@ngrx/signals` y `@ngrx/component-store` — instaladas pero **0 usos** (solo NgRx clásico). Restos de una migración iniciada y nunca ejecutada.
- `@capacitor/cli` en conflicto: `^7.4.2` (dependencies) vs `^6.0.0` (devDependencies); `@capacitor/android|core|ios` declarados dos veces.
- Nx core `21.2.1` vs `@nx/angular 22.5.1` — un major por delante. Coherente con el `npm ci --legacy-peer-deps` del CI.

**Acción sugerida:** eliminar deps/lib sin uso, unificar versiones de Capacitor y alinear el major de `@nx/angular` con el core.

#### P1.5 — `chess-extension` reimplementa ajedrez en vez de reutilizar libs

`apps/chess-extension/src/training/trainer.ts` usa `chess.js` + `cm-chessboard` directamente con lógica UCI propia, ignorando `libs/board` + `libs/stockfish-wasm`. Oportunidad de reutilización (baja urgencia, la extensión es independiente).

Adicional (auditoría 2026-10-01): `chess-extension` **no tiene ningún `*.spec.ts`**, y su `project.json` solo define targets `build`/`build-dev` vía `nx:run-commands` — **no existe target `lint` ni `test`**, así que ni siquiera un `nx affected -t lint test` (ver P0.4) lo cubriría si se reintroduce CI. También tiene la API key web de Firebase hardcodeada en texto plano en `src/shared/firebase-config.ts:2`, mientras que `chessColate` sí externaliza las suyas a `environments/private/keys.ts` (gitignoreado). Riesgo bajo — las Web API keys de Firebase son públicas por diseño, protegidas por reglas de seguridad del backend —, pero rompe la convención del resto del monorepo; conviene alinear o documentar por qué aquí es distinto.

#### P1.6 — `enforce-module-boundaries` no restringe nada entre libs

> **Estado 2026-10-07 — 🟡 Parcial.**
> - ✅ El scope quedó unificado: `models`, `state` y `widgets` pasaron de `@cpark/*` a `@chesspark/*` (`tsconfig.base.json`, `apps/chessColate/tsconfig.json`, `libs/models/package.json`, 106 archivos `.ts`, las plantillas del generador de NgRx y la documentación). Los nombres de proyecto Nx no cambian.
> - ⏳ Siguen abiertos los tags coherentes y los `depConstraints` que restrinjan de verdad.

`eslint.base.config.mjs` configura `depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]` — cualquier tag puede depender de cualquier tag, es una regla "de adorno" sin efecto real. Los tags en sí son inconsistentes entre `project.json` de cada lib: `board` usa `["board"]`; `models`, `common-utils`, `revenuecat`, `state`, `stockfish-wasm` usan `scope:shared`/`type:*`; `chess-com-provider`, `lichess-provider`, `games-provider`, `puzzles-provider` y `game-reporter` tienen `tags: []` (vacío); `widgets` tiene `tags: ["type:state", "scope:shared"]` — copiado por error, `widgets` no es estado.

A esto se suma un **scope de paquete inconsistente**: `tsconfig.base.json` mapea la mayoría de libs a `@chesspark/*`, pero `models`, `state` y `widgets` usan `@cpark/*` (confirmado en sus `package.json`, ej. `libs/models/package.json` → `"name": "@cpark/models"`). Deuda de naming que nadie notará hasta que alguien copie el patrón equivocado.

**Acción sugerida:** definir una capa real de tags (`type:models`, `type:provider`, `type:ui`, `scope:shared`, etc.) con `depConstraints` que sí restrinjan (ej. providers no deberían depender de `state`), y unificar el scope de paquete a `@chesspark/*` en las tres libs que quedaron en `@cpark/*`.

#### P1.7 — Duplicación de lógica de throttling entre `chess-com-provider` y `lichess-provider`

Ambas libs implementan casi línea por línea la misma cola de throttling de peticiones (`queue: Promise<unknown>`, `lastRequestAt`, método privado `request()` — ver `libs/chess-com-provider/src/lib/chess-com-provider.ts:27-30,102-117` vs `libs/lichess-provider/src/lib/lichess-provider.ts:22-25,90-105`). Debería extraerse a una clase base o util compartida (en `common-utils` o una nueva lib pequeña de infraestructura de providers).

#### P1.8 — `libs/widgets` es una lib placeholder sin uso

> **Estado 2026-10-07 — ✅ Resuelto.** `libs/widgets` se eliminó, junto a sus alias en `tsconfig.base.json` y `apps/chessColate/tsconfig.json`. Nadie la importaba; esas dos líneas eran sus únicas referencias en el repositorio.

38 líneas: un componente Angular (`lib-widgets`) generado por `nx g library` y nunca completado. Ningún archivo en `apps/` ni en otras `libs/` lo importa, y no tiene target `build` configurado (igual que `state`). Ya señalada como dependencia muerta en P1.4 — se repite aquí porque además arrastra el tag incorrecto de P1.6. Candidata directa a eliminar.

---

### 🟡 P2 — Calidad, tipos y rendimiento

#### P2.1 — Suscripciones y timers sin teardown (fugas potenciales)

> **Estado 2026-10-07 — ⏳ Abierto en lo sistemático** (sigue habiendo 0 usos de `takeUntilDestroyed`), con dos avances puntuales: el cronómetro de `training` vive ahora en `TrainingTimerService`, con teardown garantizado y un test que verifica que no queden timers vivos; y `closeDropdown()` guarda y cancela su `setTimeout`. Los `setTimeout` de `board-puzzle-solution` y `knight-tour` no se tocaron.

- `subscribe()` sin `takeUntil`/`takeUntilDestroyed`: `block-settings.component.ts` (**6**), `login.component.ts` (2), `plan-chart.component.ts` (1), `chess960.page.ts` (1).
- **`setTimeout` recursivos no cancelables en `ngOnDestroy`** en `board-puzzle-solution.component.ts` (`showClue` `:734`, `rollBackMove` `:635`, `startMoves` `:780/792`) y `knight-tour.page.ts` (`:114/247/712`): si se cierra el modal a mitad, los timeouts siguen vivos y tocan `this.board` ya destruido.
- Manejo inconsistente de Subjects de timer en `board-puzzle-solution.component.ts:388-412` (`.complete()` impide re-suscribir).

**Acción sugerida:** adoptar `takeUntilDestroyed()` de forma sistemática y reemplazar `setTimeout` recursivos por RxJS con `takeUntil(destroy$)`.

#### P2.2 — Cero `ChangeDetectionStrategy.OnPush` con timers de alta frecuencia

- **0 componentes** usan OnPush en `apps/chessColate` y `libs/board`.
- Timers que disparan CD global: `interval(10)` (cada 10 ms) en `coordinates.page.ts:380`; `interval(100)` en `board-puzzle.component.ts:628` y `knight-tour.page.ts:653`. Con CD por defecto reevalúan todo el árbol ~100 veces/seg → impacto en rendimiento y batería en móvil.

**Acción sugerida:** OnPush (o signals) en componentes con timers; subir el `interval(10)` a un valor razonable.

#### P2.3 — Testing real muy bajo

> **Estado 2026-10-07 — 🟡 Mejorado, con deuda nueva.**
> - La app pasó de 9 a 28 specs (323 tests). `training.component.spec.ts` ya no está vacío: tiene 58 tests de caracterización del flujo. Hay specs nuevos para `block.service`, utils, servicios de sesión y cronómetro, `PuzzleEngine` y `StockfishEngineFacade`.
> - `libs/board` tiene ahora `move-input-behavior.spec.ts` (26 tests), que cubre el manejador de movimientos de los dos tableros de puzzle, y specs para la fábrica del tablero y las utilidades de marcadores.
> - ⏳ Siguen sin existir tests e2e, y `revenuecat` y `models` no tienen specs.
> - ⚠️ La app tiene 8 suites que no compilan o no arrancan (`fetch` no definido con Firebase, módulo `chess960` ausente, `IonicModule`, JSON inválido en `plan-played`) y 2 tests `should create` que fallan (`BlockPresentationComponent`, `TrainingMenuComponent`). `libs/board` tiene 4 suites en la misma situación.
> - ⚠️ **Nuevo:** 11 de las 12 suites de `libs/state` no compilan. Los specs de `plan` y `plansElos` se escribieron contra un estado generado que nunca se actualizó (`Property 'error' does not exist on type 'PlansElosState'`, entre otros).

- **78 % de los specs** tienen ≤1 caso y ese caso es el `should create` autogenerado.
- La app en producción (`chessColate`) tiene **9 specs**, casi todos boilerplate; `training.component.spec.ts` está **vacío (0 bytes)**.
- Cypress y `@nx/cypress` instalados y en CI, pero **no existe ningún `cypress.config.ts` ni `*.cy.ts`**: el target `e2e` es no-op.
- Los tests genuinos están en libs: `puzzles-provider` (21 it), `common-utils/random-fen` (19 it), `stockfish-wasm`, `state` (reducers/selectors/effects).
- **`libs/revenuecat` tiene cero specs** — preocupante por ser la lib que gestiona compras, restauración y entitlements. `libs/models` (la base tipada de todo el sistema) tampoco tiene ningún spec.

**Acción sugerida:** priorizar tests de `block.service`, `firestore.service`, facades y `revenuecat`; añadir al menos un smoke e2e real.

#### P2.4 — `any` y casts inseguros

- 124 `any` en código activo, concentrados en serialización de Firestore (`firestore.service.ts:402-670`: `cleanBlocks`, `removeUndefined`, `serializeFirestoreData<T>(data: any): T`) y en el modelo de `elos` (`profile.service.ts:230-343`, `Record<string, any>` repetido).
- Acceso a interno privado saltándose la API pública: `(this.boardComponent as any).board` en `coordinates.page.ts:198-200`.
- `libs/revenuecat/src/lib/services/revenuecat.service.ts` concentra **33 `any`/`as any`**, casi todos `error as any` en bloques `catch` (mapeo de errores del SDK nativo/web de RevenueCat sin tipos propios) más un `import(...) as any` para el módulo web (tipos no expuestos correctamente por el paquete).
- El `.d.ts` casero para `cm-chessboard` (la librería no trae tipos) está **duplicado en dos sitios** con ~11 `any` cada uno: `libs/board/src/types/cm-chessboard.d.ts` y `apps/chessColate/src/types/cm-chessboard.d.ts`. Debería vivir solo en `libs/board` y reexportarse.

#### P2.5 — Logging sin estructura

> **Estado 2026-10-07 — 🟡 Parcial.** Los `console.log('Plan ', …)` de `training.component.ts` ya no existen. Sigue abierto lo demás: no hay logger con niveles ni regla `no-console`.

- 234 `console.*` en producción, sin logger con niveles. Algunos vuelcan datos de usuario: `console.log('Plan ', this.plan)` en `training.component.ts:190, :563, :823`.
- `libs/stockfish-wasm` concentra ~48 `console.log`/`console.error` entre sus 4 archivos, siempre activos (no hay flag de debug/verbose). Además, `stockfish-worker.service.ts:65` detecta memoria corrupta del engine con matching de string (`error.message.includes('memory access out of bounds')`) en vez de un manejo tipado — frágil si el mensaje de error cambia entre versiones del wasm. `stockfish-analysis.service.ts` (491 líneas) gestiona suscripciones RxJS manualmente con múltiples `.subscribe({...})`/`unsubscribe()` repetidos en vez de operadores (`take(1)`, `firstValueFrom`, `timeout`), patrón propenso a fugas si un path de error no limpia la suscripción.
- Existe `crashlytics-error-handler.ts` en `chessColate`, pero solo reporta errores — no hay logger informativo, de ahí que `console.log` se use como sustituto informal en todo el repo.

**Acción sugerida:** servicio de logging con niveles + regla ESLint `no-console` (warn) + strip en build de producción.

#### P2.6 — Dato personal commiteado

> **Estado 2026-10-07 — 🟡 Parcial.** El PGN se sacó del seguimiento de git (la copia local se conserva) y `test_data/` está en `.gitignore`. **Sigue en el historial de git y en el remoto**: quitarlo del todo exige reescribir el historial (`git filter-repo` y push forzado), una decisión que afecta a todas las ramas y clones.

- `test_data/lichess_Json_alzate_2026-03-06.pgn` — **1.65 MB de PGN real de una cuenta Lichess personal** en el repo. Conviene moverlo a fixtures anonimizadas o eliminarlo del historial.

#### P2.7 — `strict` no está en la base

- `tsconfig.base.json` no activa `strict`/`strictNullChecks`; se activa por proyecto (`apps/chessColate`, libs y `chess-extension` sí lo tienen). Subirlo a la base da uniformidad y evita que nuevos proyectos hereden la config laxa.

---

### 🟢 P3 — Frágil pero de bajo impacto

- **Parche que reescribe `node_modules`:** `scripts/fix-ng-packagr-esm.js` sobrescribe archivos de `find-cache-directory`/`ora` en cada `npm install`, sin `patch-package`. Cualquier bump los rompe en silencio → migrar a `patch-package`. (`scripts/patch-capacitor-firebase-podspec.js` está mejor diseñado: idempotente y con skip seguro.)
- `@Injectable()` **y** `@Component()` apilados en `board-puzzle.component.ts:83-89` (el `@Injectable` sobra); ese componente no declara `standalone: true` mientras su gemelo sí → inconsistencia.
- `import * as _ from 'lodash'` completo para un solo archivo; migrable a import granular o util nativa. `prettier ^2.6.2` desactualizado (v3 disponible).
- Magic numbers/strings dispersos: ELO base `400`, `333`, `depth: 15`, keys de `localStorage` (`'chesscolate_reto333_stats'`), delays `200/400/500/1000/1500/3000`. Centralizar en constantes.
- Paleta de confetti hardcodeada (`'#FFD700', '#FFA500'...`) en `coordinates.page.ts:513-520` en vez del token de marca del [STYLE_GUIDE](./STYLE_GUIDE.md) (`#bf811c`). Nombres de clases de marcador (`marker-square-green`...) como strings mágicos dispersos en TS.

---

## 3. Plan de acción recomendado

### Quick wins (bajo riesgo, alto retorno) — ~1 sprint
1. ⏳ **Reintroducir un workflow de CI de solo verificación** (`nx affected -t lint test build` en PRs), sin auto-deploy — ver P0.4.
2. ✅ Eliminar dependencias/lib sin uso: `@lichess-org/chessground`, `@ngrx/signals`, `@ngrx/component-store` y `libs/widgets` — hecho 2026-10-07.
3. ✅ Unificar versiones de `@capacitor/cli` (requiere `npm install`) y alinear `@nx/angular` con el core de Nx — hecho 2026-10-07. Queda `prettier`, aparte.
4. 🟡 Sacar `test_data/*.pgn` del repo: ✅ fuera del árbol y en `.gitignore` (2026-10-07); ⏳ sigue en el historial (ver P2.6).
5. ⏳ Regla ESLint `no-console` y limpieza de logs que vuelcan datos de usuario (los de `training` ya se quitaron).
6. ✅ Unificar scope de paquete a `@chesspark/*` en `models`, `state` y `widgets` (P1.6) — hecho 2026-10-07.

### Refactors de fondo (planificados)
7. ✅ Factory + manejador de movimientos y utilidades de marcadores en `libs/board` (elimina la duplicación de P1.1) — hecho 2026-10-07 (`createChessboard`, `createMoveInputHandler`, `board-markers`). Queda el parseo de la solución.
8. ✅ Partir `firestore.service.ts` por agregado y descomponer `generateBlocksForPlan` — hecho (`af5e993`).
9. ✅ Forzar acceso a datos vía facades; prohibir `FirestoreService` en componentes — hecho (`af5e993`).
10. `takeUntilDestroyed()` sistemático + OnPush en componentes con timers.
11. Definir tags reales y `depConstraints` efectivos en `enforce-module-boundaries` (P1.6).
12. Extraer base compartida de throttling entre `chess-com-provider` y `lichess-provider` (P1.7).

### Deuda de calidad (continua)
13. Tests reales para `block.service`, `firestore.service`, facades y `revenuecat`; al menos un smoke e2e en Cypress.
14. Unificar `getRandomTheme` y la lógica de temas/debilidades en un único servicio.
15. Subir `strict` a `tsconfig.base.json`; reducir `any` en la serialización de Firestore y en `revenuecat.service.ts`.
16. Reemplazar matching de strings de error en `stockfish-worker.service.ts` por manejo tipado; añadir flag de debug para sus ~48 `console.*`.
17. Añadir target `lint`/`test` a `apps/chess-extension` y cubrirlo con al menos smoke tests.

---

## 4. Priorización rápida

| ID | Hallazgo | Prioridad | Esfuerzo | Estado 2026-10-07 |
|----|----------|-----------|----------|-------------------|
| P0.1 | God-services (`block`/`firestore`) y método de ~700 líneas | Alta | Alto | ✅ Resuelto |
| P0.2 | Componentes God-object con dominio incrustado | Alta | Alto | 🟡 Parcial |
| P0.3 | Bypass de facades → Firestore directo en UI | Alta | Medio | ✅ Resuelto |
| P0.4 | **CI eliminado por completo** (no solo sin gate) | Alta | Bajo | ⏳ Abierto |
| P1.1 | Duplicación de lógica de tablero | Media-Alta | Medio | 🟡 Parcial |
| P1.2 | Lógica de temas/debilidades duplicada | Media-Alta | Medio | ⏳ Abierto |
| P1.3 | Doble fuente de estado (Store + campo mutable) | Media | Bajo | ⏳ Abierto |
| P1.4 | Deps muertas / conflictos de versión | Media | Bajo | 🟡 Parcial |
| P1.5 | `chess-extension` no reutiliza libs, sin tests ni target lint/test | Baja-Media | Alto | ⏳ Abierto |
| P1.6 | `enforce-module-boundaries` sin restricciones reales + scope `@cpark` vs `@chesspark` | Media | Bajo | 🟡 Parcial |
| P1.7 | Duplicación de throttling entre `chess-com-provider`/`lichess-provider` | Media | Bajo | ⏳ Abierto |
| P1.8 | `libs/widgets` placeholder sin uso | Baja | Bajo | ✅ Resuelto |
| P2.1 | Suscripciones/timers sin teardown | Media-Alta | Medio | ⏳ Abierto |
| P2.2 | Sin OnPush + timers de alta frecuencia | Media | Medio | ⏳ Abierto |
| P2.3 | Cobertura de tests ~10-15 %, `revenuecat` sin specs, e2e no-op | Media-Alta | Alto | 🟡 Mejorado |
| P2.4 | `any` / casts inseguros (incl. 33 en `revenuecat`, `.d.ts` de cm-chessboard duplicado) | Media | Medio | ⏳ Abierto |
| P2.5 | Logging sin estructura (incl. ~48 console.* sin flag en `stockfish-wasm`) | Media | Bajo | 🟡 Parcial |
| P2.6 | PGN personal commiteado | Media | Bajo | 🟡 Parcial |
| P2.7 | `strict` no está en la base | Media | Bajo | ⏳ Abierto |
| P3.* | Parches frágiles, magic numbers, estilos hardcoded | Baja | Bajo | ⏳ Abierto |

---

*Informe generado a partir de análisis estático del repositorio. Las referencias `archivo:línea` corresponden al estado de la rama `feat/chesscolate-ux-onboarding` (versión original) y `main` (actualización 2026-10-01), y pueden desplazarse con cambios posteriores.*
