# Informe de migración Chesscolate-old → chessColate

## Introducción

Este documento describe el estado de la migración desde la aplicación legacy **Chesscolate-old** hacia **chessColate**. Sirve como referencia de lo que falta por migrar, lo que está solo parcialmente implementado y las funcionalidades que no están funcionando al 100%.

- **Origen:** `apps/Chesscolate-old` (Angular con NgRx, módulos).
- **Destino:** `apps/chessColate` (Angular standalone, lazy loading, PlanFacade/estado).
- **Propósito:** Identificar gaps de funcionalidad y priorizar tareas de migración.

---

## 1. Resumen de alcance actual

### chessColate (nuevo)

- **Rutas:** `home`, `puzzles/training`, `puzzles/plan-played` (standalone, lazy).
- **Flujo:** Home → menú de planes (solo planes por número: 1, 3, 5, 10, 20, 30) → training → plan-played.
- **Servicios clave:** BlockService, PlanService, ProfileService, PlanFacadeService (estado), FirestoreService.
- **Libs compartidas:** `@chesspark/board` (BoardPuzzle, BoardPuzzleSolution), `@cpark/state`, `@cpark/models`, `@chesspark/puzzles-provider`.

### Chesscolate-old (legacy)

Además de un flujo similar de puzzles, incluía: **Coordinates**, **Squares**, **Privacy**, **Custom training**, **Plans history**, **Activity chart**, opciones **Warmup** y **Back to calm** en el menú, **guards** y persistencia de planes vía **NgRx**.

---

## 2. Rutas y páginas

### 2.1 Comparativa de rutas

| Ruta en old | Ruta en new | Estado |
|-------------|-------------|--------|
| `puzzles` (redirect a training-menu) | `home` | Migrado (equivalente como entrada) |
| `puzzles/training-menu` | Contenido en `home` (TrainingMenuComponent) | Parcial: solo planes 1,3,5,10,20,30 |
| `puzzles/training` | `puzzles/training` | Migrado |
| `puzzles/plan-played` | `puzzles/plan-played` | Migrado |
| `puzzles/custom-training` | — | **No migrado** |
| `puzzles/plans-history` | — | **No migrado** |
| `coordinates` (→ coordinates/training) | — | **No migrado** |
| `squares` (→ squares/training) | — | **No migrado** |
| `privacy` | — | **No migrado** |

### 2.2 Páginas / funcionalidades no migradas

| Funcionalidad | En old | En new | Notas |
|---------------|--------|--------|--------|
| **Coordinates** | `/coordinates` (CoordinatesPage) | No existe | Entrenamiento: mostrar nombre de casilla y clicar en el tablero; timer, puntuación, opciones (coordenadas visibles, piezas, posición aleatoria). Firestore ya tiene `coordinatesPuzzles` y `FirestoreService` tiene `addCoordinatesPuzzle` y lectura; falta la página y el guard `CoordinatesPuzzlesGuard`. |
| **Squares** | `/squares` (SquaresPage) | No existe | Juego de identificar casillas (deslizar/arrastrar); SquaresService en old. Solo i18n en new. |
| **Privacy** | `/privacy` (PrivacyPage) | No existe | Página de política de privacidad. Solo i18n en new. |
| **Custom training** | `/puzzles/custom-training` | No existe | Crear rutina con varios bloques; cada bloque se configura con BlockSettingsComponent (duración, tiempo por puzzle, **a ciegas**, mostrar solución, tema, etc.). Guardado como “custom plan” y reutilizable. |
| **Plans history** | `/puzzles/plans-history` + slides en training-menu | No existe | Historial de planes jugados; en el menú se mostraban los últimos planes y “Tus creaciones” (custom plans). |
| **Training menu completo** | Warmup, Back to calm, Custom, Download APP, Activity chart | Solo cards plan 1,3,5,10,20,30 | BlockService ya tiene `warmup` y `backToCalm`; no están expuestos en el menú de home. |

---

## 3. Funcionalidades incompletas o que no funcionan del todo

### 3.1 Ejercicios a la ciegas

- **Estado:** Parcialmente migrado.

- **Qué sí hay:**
  - En **libs/board** (`board-puzzle.component.ts`): lógica de `goshPuzzleTime`, cuenta atrás y aplicación de `opacity` a las piezas cuando el tiempo llega a 0.
  - En **BlockService** (chessColate): bloques con `goshPuzzle: true` y `goshPuzzleTime` (10 o 15 s) en **plan20** y **plan30**.
  - En **TrainingComponent**: se pasa `goshPuzzleTime` del bloque al puzzle y se muestra el helper (`isGoshHelperShow`) cuando aplica.

- **Qué falta:**
  - No existe **rutina personalizada** ni **BlockSettings**: el usuario no puede activar “A ciegas” ni configurar “Tiempo visible” para ningún bloque propio. En old esto se hacía en BlockSettingsComponent (toggle “A ciegas” y rango `goshPuzzleTime`).

- **Conclusión:** “A ciegas” **funciona solo en los planes predefinidos 20 y 30**. No hay UI para usar esta opción en rutinas propias hasta que exista custom training con configuración de bloque.

### 3.2 Persistencia del plan al finalizar

- **Estado:** No implementado en chessColate.

- **Evidencia:** En `training.component.ts` (aprox. líneas 438–442) está comentado `this.planService.requestSavePlanAction(this.plan)` y no se llama a `planService.savePlan(plan)`. Solo se actualiza el estado (PlanFacade) y se navega a plan-played.

- **Consecuencia:** Los planes finalizados **no se persisten en Firestore**; no hay historial persistente ni “Tus creaciones” aunque luego se migre la UI.

- **Acción recomendada:** Implementar la llamada a guardado del plan al finalizar (p. ej. en `endPlan()`), usando `PlanService.savePlan(plan)` y `FirestoreService`. Si se introduce estado global para el guardado, mantener coherencia con el flujo (en old se usaba NgRx: requestSavePlan → effect → PlanService.savePlan).

### 3.3 Historial y planes personalizados en UI

- No existe en home la sección **“Historial”** ni **“Tus creaciones”**.
- En Firestore (chessColate) ya existe lógica para `custom-plans` y para planes (p. ej. en `firestore.service.ts`); lo que falta es la **carga** de esos datos y la **UI** (plan-played actual es solo para el plan recién terminado en sesión).

---

## 4. Otros elementos a documentar

### Guards

En old se usaban: **PlansGuard**, **PlansElosGuard**, **CustomPlansGuard**, **CoordinatesPuzzlesGuard** en las rutas de puzzles y coordinates. En chessColate no hay equivalentes. Conviene definir si se quieren restricciones o carga previa de datos (p. ej. planes, elos, puzzles de coordenadas) antes de entrar a puzzles o a coordinates.

### Activity chart

Componente de gráfico de actividad en el training-menu de old; **no migrado**. No existe en chessColate.

### Redux vs PlanFacade (flujo de guardado)

- **Old:** Guardaba planes vía NgRx: acción `requestSavePlan` → effect → `PlanService.savePlan(plan)` → Firestore.
- **New:** Usa PlanFacade para el plan en memoria; no se dispara ningún guardado. La migración de “guardar plan” puede hacerse desde el mismo lugar donde hoy se actualiza el plan (p. ej. en `endPlan()`) llamando a `PlanService.savePlan(plan)` o al método equivalente de Firestore.

---

## 5. Referencia de archivos clave

| Ámbito | Archivo / ruta |
|--------|-----------------|
| Rutas (new) | `apps/chessColate/src/app/app.routes.ts` |
| Rutas (old) | `apps/Chesscolate-old/src/app/app-routing.module.ts`, `apps/Chesscolate-old/src/app/pages/puzzles/puzzles-routing.module.ts` |
| Generación de bloques/planes | `apps/chessColate/src/app/services/block.service.ts` |
| Entrenamiento (flujo, plan, puzzle) | `apps/chessColate/src/app/pages/puzzles/containers/training/training.component.ts` |
| Menú de planes | `apps/chessColate/src/app/pages/home/components/training-menu.component.ts`, `training-menu.component.html` |
| Configuración de bloque (old, incl. a ciegas) | `apps/Chesscolate-old/src/app/pages/puzzles/components/block-settings/block-settings.component.*` |
| Tablero puzzle (lógica a ciegas) | `libs/board/src/lib/board-puzzle/board-puzzle.component.ts` |
| Plan y persistencia | `apps/chessColate/src/app/services/plan.service.ts`, `apps/chessColate/src/app/services/firestore.service.ts` |
| Modelos Block / Plan | `libs/models/src/lib/block.model.ts`, `libs/models/src/lib/plan.model.ts` |
