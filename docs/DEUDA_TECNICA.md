# Informe de Deuda Técnica — ChessPark

> **Fecha:** 2026-07-02
> **Rama analizada:** `feat/chesscolate-ux-onboarding`
> **Stack:** Nx 21 · Angular 20 (standalone) · Ionic 8 · Capacitor 7 · NgRx clásico · Firebase/Firestore · RevenueCat
> **Alcance:** código activo (`apps/chessColate`, `apps/chess-extension`, `libs/*`). `apps/Chesscolate-old` queda **fuera de alcance**: es legacy congelado que se conserva deliberadamente como referencia de migración (ver [MIGRACION_CHESSCOLATE.md](./MIGRACION_CHESSCOLATE.md)).

---

## 1. Resumen ejecutivo

El código activo está en buena forma arquitectónica de base (Angular standalone, lazy loading, libs Nx, `strict` por proyecto, NgRx con facades). La deuda se concentra en **cuatro focos**:

1. **God-objects**: un método de ~700 líneas y varios servicios/componentes de 850–950 líneas que mezclan dominio, persistencia y UI.
2. **Duplicación de lógica de tablero** dentro de `libs/board` (el propio código lo documenta con comentarios).
3. **Bypass de la capa de datos**: componentes que llaman a Firestore directamente, saltándose los facades existentes.
4. **Red de seguridad débil**: cobertura de tests real ~10-15 %, e2e no-op, y deploy sin lint/test.

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

- `apps/chessColate/src/app/services/block.service.ts:68-767` — `generateBlocksForPlan()` es **un único método de ~700 líneas** con ramas copy-paste casi idénticas por tamaño de plan (plan3/5/10/20/30), cada una repitiendo `getRandomTheme` / `getWeaknessInPlan` (`:172, :217, :274, :372, :535`). Complejidad ciclomática muy alta, imposible de testear por unidad. Mezcla generación de bloques, selección de temas/aperturas, cálculo de debilidades y consulta de puzzles.
- `apps/chessColate/src/app/services/firestore.service.ts` (915 líneas) — repositorio monolítico con ~30 métodos públicos: perfiles, nicknames, coordinates, user puzzles, planes, plan-elos, custom plans, public plans, interacciones y stats.

**Acción sugerida:**
- Descomponer `generateBlocksForPlan` en una estrategia parametrizada por configuración de plan (tabla de tamaños) en lugar de ramas duplicadas.
- Partir `firestore.service.ts` por agregado: `ProfileRepository`, `PlanRepository`, `PublicPlanRepository`, `InteractionRepository`.

#### P0.2 — Componentes God-object con lógica de dominio incrustada

- `apps/chessColate/src/app/pages/puzzles/containers/training/training.component.ts:76` (953 líneas): cálculo de ELO por tipo de plan (`saveInitialMaxElo` `:221-255`), **persistencia directa a `localStorage`** con `JSON.parse`/`try-catch` inline (`showReto333Alert` `:656-715`), parseo de FEN en un getter (`playerColor` `:122-135`), y `onPuzzleCompleted` `:515-627` que mezcla dominio, sonidos y UI.
- `libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts:54` (917 líneas): un componente de UI gestiona **todo el ciclo de vida de Stockfish** (init/terminate/reintentos/errores de worker) `:116-281`.
- `libs/board/src/lib/board-puzzle/board-puzzle.component.ts:90` (871 líneas): motor de puzzle completo (validación, promoción, timers, hints) dentro del componente.

**Acción sugerida:** mover ELO/reto333/persistencia a servicios de dominio; encapsular Stockfish en un facade que exponga "analiza esta posición" y oculte el ciclo de vida del worker.

#### P0.3 — Componentes que acceden a Firestore saltándose los facades

Existe infraestructura de facades (`plan-facade.service.ts`, `public-plans-facade.service.ts`) pero varios componentes la eluden, creando **dos caminos de datos** (Store vs Firestore directo):

- `apps/chessColate/src/app/pages/puzzles/containers/public-plans/public-plans.component.ts:113, :139, :165` — `getPublicPlan()` directo.
- `apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts:231` — `getPlanInteraction()` directo.
- Ya reconocido en el código: `// TODO: no llamar directamente a firestore, pasar por el facade o store` en `apps/chessColate/src/app/services/custom-plans.service.ts:38`.

**Acción sugerida:** exponer estos accesos a través de los facades/Store y prohibir la inyección de `FirestoreService` en componentes (regla de lint de arquitectura).

#### P0.4 — Deploy sin red de seguridad

- `.github/workflows/firebase-deploy.yml` hace solo `nx build` + `firebase deploy`: **no ejecuta lint ni test antes de publicar**. Se puede desplegar código que nunca pasó por CI.
- `.github/workflows/ci.yml` sí corre `nx affected -t lint test build e2e`, pero `e2e` no ejecuta nada (ver P2.3).

**Acción sugerida:** añadir `nx affected -t lint test` como paso previo al deploy (o exigir que el deploy solo dispare tras un CI verde).

---

### 🟠 P1 — Duplicación y consistencia

#### P1.1 — Duplicación de lógica de tablero en `libs/board`

El handler `enableMoveInput` (~120 líneas, incl. bloque de promoción de peón) está **duplicado casi literal** entre:
- `libs/board/src/lib/board-puzzle/board-puzzle.component.ts:303-455`
- `libs/board/src/lib/board-puzzle-solution/board-puzzle-solution.component.ts:440-566`

El propio código lo admite: `// Aplicar correcciones de board-puzzle.component.ts para promoción...` (`board-puzzle-solution.component.ts:463`).

También duplicados: `showLastMove`, `removeMarkerNotLastMove`, `turnRoundBoard`, `puzzleMoveResponse`, y el parseo de solución `getMoves`/`initPuzzle`. La construcción de `new Chessboard(...)` (mismos `assetsUrl`, `BORDER_TYPE`, extensiones Markers/Arrows/PromotionDialog) se repite en **5 archivos**: board, board-puzzle, board-puzzle-solution, fen-board, chess960-board.

**Acción sugerida:** una factory `createChessboard(config)` + un servicio/mixin de manejo de movimientos y marcadores en `libs/board`.

#### P1.2 — Lógica de negocio de temas/debilidades dispersa

- `getRandomTheme` tiene **dos implementaciones divergentes**: `block.service.ts:767` (usa `appService.getThemesPuzzlesList`) vs `libs/puzzles-provider/src/lib/puzzles-provider.ts:260` (usa `getManifestThemes()`). Dos fuentes de verdad que pueden devolver conjuntos distintos.
- Selección de debilidad/fortaleza re-implementada en 3 servicios: `plans-elos.service.ts:151/164`, `block.service.ts:789/815/841`, `plan.service.ts:44-47`.

**Acción sugerida:** consolidar en un único `ThemeSelectionService` con una sola fuente de temas.

#### P1.3 — Doble fuente de estado (Store + campo mutable)

- `apps/chessColate/src/app/services/profile.service.ts:51-63` mantiene `this.profile` sincronizado manualmente desde el Store mediante un `subscribe()` en el constructor **sin teardown**. El perfil vive en dos lugares (Store y campo del servicio). Antipatrón aunque el servicio sea singleton.

#### P1.4 — Dependencias declaradas pero no usadas / en conflicto

- `@lichess-org/chessground ^9.3.1` — **0 usos**; todo el código usa `cm-chessboard`. Peso muerto.
- `libs/widgets` (`@cpark/widgets`) — **no la importa nadie**; lib huérfana.
- `@ngrx/signals` y `@ngrx/component-store` — instaladas pero **0 usos** (solo NgRx clásico). Restos de una migración iniciada y nunca ejecutada.
- `@capacitor/cli` en conflicto: `^7.4.2` (dependencies) vs `^6.0.0` (devDependencies); `@capacitor/android|core|ios` declarados dos veces.
- Nx core `21.2.1` vs `@nx/angular 22.5.1` — un major por delante. Coherente con el `npm ci --legacy-peer-deps` del CI.

**Acción sugerida:** eliminar deps/lib sin uso, unificar versiones de Capacitor y alinear el major de `@nx/angular` con el core.

#### P1.5 — `chess-extension` reimplementa ajedrez en vez de reutilizar libs

`apps/chess-extension/src/training/trainer.ts` usa `chess.js` + `cm-chessboard` directamente con lógica UCI propia, ignorando `libs/board` + `libs/stockfish-wasm`. Oportunidad de reutilización (baja urgencia, la extensión es independiente).

---

### 🟡 P2 — Calidad, tipos y rendimiento

#### P2.1 — Suscripciones y timers sin teardown (fugas potenciales)

- `subscribe()` sin `takeUntil`/`takeUntilDestroyed`: `block-settings.component.ts` (**6**), `login.component.ts` (2), `plan-chart.component.ts` (1), `chess960.page.ts` (1).
- **`setTimeout` recursivos no cancelables en `ngOnDestroy`** en `board-puzzle-solution.component.ts` (`showClue` `:734`, `rollBackMove` `:635`, `startMoves` `:780/792`) y `knight-tour.page.ts` (`:114/247/712`): si se cierra el modal a mitad, los timeouts siguen vivos y tocan `this.board` ya destruido.
- Manejo inconsistente de Subjects de timer en `board-puzzle-solution.component.ts:388-412` (`.complete()` impide re-suscribir).

**Acción sugerida:** adoptar `takeUntilDestroyed()` de forma sistemática y reemplazar `setTimeout` recursivos por RxJS con `takeUntil(destroy$)`.

#### P2.2 — Cero `ChangeDetectionStrategy.OnPush` con timers de alta frecuencia

- **0 componentes** usan OnPush en `apps/chessColate` y `libs/board`.
- Timers que disparan CD global: `interval(10)` (cada 10 ms) en `coordinates.page.ts:380`; `interval(100)` en `board-puzzle.component.ts:628` y `knight-tour.page.ts:653`. Con CD por defecto reevalúan todo el árbol ~100 veces/seg → impacto en rendimiento y batería en móvil.

**Acción sugerida:** OnPush (o signals) en componentes con timers; subir el `interval(10)` a un valor razonable.

#### P2.3 — Testing real muy bajo

- **78 % de los specs** tienen ≤1 caso y ese caso es el `should create` autogenerado.
- La app en producción (`chessColate`) tiene **9 specs**, casi todos boilerplate; `training.component.spec.ts` está **vacío (0 bytes)**.
- Cypress y `@nx/cypress` instalados y en CI, pero **no existe ningún `cypress.config.ts` ni `*.cy.ts`**: el target `e2e` es no-op.
- Los tests genuinos están en libs: `puzzles-provider` (21 it), `common-utils/random-fen` (19 it), `stockfish-wasm`, `state` (reducers/selectors/effects).

**Acción sugerida:** priorizar tests de `block.service`, `firestore.service` y facades; añadir al menos un smoke e2e real.

#### P2.4 — `any` y casts inseguros

- 124 `any` en código activo, concentrados en serialización de Firestore (`firestore.service.ts:402-670`: `cleanBlocks`, `removeUndefined`, `serializeFirestoreData<T>(data: any): T`) y en el modelo de `elos` (`profile.service.ts:230-343`, `Record<string, any>` repetido).
- Acceso a interno privado saltándose la API pública: `(this.boardComponent as any).board` en `coordinates.page.ts:198-200`.

#### P2.5 — Logging sin estructura

- 234 `console.*` en producción, sin logger con niveles. Algunos vuelcan datos de usuario: `console.log('Plan ', this.plan)` en `training.component.ts:190, :563, :823`.

**Acción sugerida:** servicio de logging con niveles + regla ESLint `no-console` (warn) + strip en build de producción.

#### P2.6 — Dato personal commiteado

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
1. Eliminar dependencias/lib sin uso: `@lichess-org/chessground`, `@ngrx/signals`, `@ngrx/component-store`, `libs/widgets`.
2. Unificar versiones de `@capacitor/cli` y alinear `@nx/angular` con el core de Nx.
3. Sacar `test_data/*.pgn` del repo (mover a fixtures anonimizadas).
4. Añadir `lint` + `test` como gate previo al deploy en `firebase-deploy.yml`.
5. Regla ESLint `no-console` y limpieza de logs que vuelcan datos de usuario.

### Refactors de fondo (planificados)
6. Factory + servicio de tablero en `libs/board` (elimina la duplicación de P1.1).
7. Partir `firestore.service.ts` por agregado y descomponer `generateBlocksForPlan`.
8. Forzar acceso a datos vía facades; prohibir `FirestoreService` en componentes.
9. `takeUntilDestroyed()` sistemático + OnPush en componentes con timers.

### Deuda de calidad (continua)
10. Tests reales para `block.service`, `firestore.service` y facades; al menos un smoke e2e en Cypress.
11. Unificar `getRandomTheme` y la lógica de temas/debilidades en un único servicio.
12. Subir `strict` a `tsconfig.base.json`; reducir `any` en la serialización de Firestore.

---

## 4. Priorización rápida

| ID | Hallazgo | Prioridad | Esfuerzo |
|----|----------|-----------|----------|
| P0.1 | God-services (`block`/`firestore`) y método de ~700 líneas | Alta | Alto |
| P0.2 | Componentes God-object con dominio incrustado | Alta | Alto |
| P0.3 | Bypass de facades → Firestore directo en UI | Alta | Medio |
| P0.4 | Deploy sin lint/test | Alta | Bajo |
| P1.1 | Duplicación de lógica de tablero | Media-Alta | Medio |
| P1.2 | Lógica de temas/debilidades duplicada | Media-Alta | Medio |
| P1.3 | Doble fuente de estado (Store + campo mutable) | Media | Bajo |
| P1.4 | Deps muertas / conflictos de versión | Media | Bajo |
| P1.5 | `chess-extension` no reutiliza libs | Baja | Alto |
| P2.1 | Suscripciones/timers sin teardown | Media-Alta | Medio |
| P2.2 | Sin OnPush + timers de alta frecuencia | Media | Medio |
| P2.3 | Cobertura de tests ~10-15 %, e2e no-op | Media-Alta | Alto |
| P2.4 | `any` / casts inseguros | Media | Medio |
| P2.5 | Logging sin estructura | Media | Bajo |
| P2.6 | PGN personal commiteado | Media | Bajo |
| P2.7 | `strict` no está en la base | Media | Bajo |
| P3.* | Parches frágiles, magic numbers, estilos hardcoded | Baja | Bajo |

---

*Informe generado a partir de análisis estático del repositorio. Las referencias `archivo:línea` corresponden al estado de la rama `feat/chesscolate-ux-onboarding` en la fecha indicada y pueden desplazarse con cambios posteriores.*
