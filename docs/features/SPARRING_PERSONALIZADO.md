# Sparring Personalizado — IA que juega con tu estilo — Feature Document

## Concepto

Un **rival de práctica (sparring) personalizado**: a partir de las **partidas reales del usuario** (importadas de **lichess** y/o **chess.com**), la app construye un **modelo de estilo** que juega **con la fuerza y las tendencias de ese jugador** — sus aperturas, su nivel de riesgo, sus errores típicos, su ELO aproximado.

La idea no es tener "un motor fuerte con la dificultad bajada", sino un **clon jugable de ti mismo** (o de otro jugador cuyas partidas importes): un oponente que abre como tú abres, ataca donde tú atacas y **falla donde tú fallas**. Sirve para:

- **Entrenar contra tu propio nivel** sin frustrarte contra un motor perfecto ni aburrirte contra uno tonto.
- **Estudiar tus propias debilidades** jugando contra ellas ("juego contra mí mismo y veo qué me cuesta").
- **Clonar a un rival concreto** antes de un torneo (importas sus partidas públicas y practicas contra su estilo).

Además, el modelo se **auto-entrena**: cada vez que el usuario sincroniza partidas nuevas (o juega en la propia app), el perfil de estilo se **recalcula/afina** para seguir pareciéndose a cómo juega hoy.

> **Relación con [Game Analytics](./GAME_ANALYTICS.md)**: aquella feature ya define los **providers** (`@chesspark/chess-com-provider`, `@chesspark/lichess-provider`), el **caché local** de partidas y el modelo canónico `ChessGame` en `libs/models`. Este sparring **consume esa misma ingesta** — no la reinventa. Game Analytics *describe* tu juego; el Sparring lo *reproduce*.

> **Relación con [`@chesspark/stockfish-wasm`](../../libs/stockfish-wasm/src/lib/)**: el sparring de nivel 1 (on-device) se apoya en Stockfish como "juez de legalidad y de fuerza" pero **sesga y degrada** su selección de jugadas hacia el estilo del jugador. No es Stockfish jugando; es Stockfish restringido por tu perfil.

---

## Objetivos

- Convertir un historial de partidas (PGN de lichess/chess.com) en un **perfil de estilo** legible y accionable.
- Ofrecer un **oponente jugable** que aproxima la **fuerza (ELO)** y las **tendencias** del jugador perfilado.
- Permitir **clonar a otro jugador** a partir de sus partidas públicas (no solo a uno mismo).
- **Auto-entrenamiento**: reajustar el perfil cuando llegan partidas nuevas, sin intervención manual.
- Empezar **on-device y sin backend** (perfil estadístico + Stockfish sesgado) y dejar la puerta abierta a un **modelo neuronal personalizado en la nube** (estilo Maia fine-tuneado) como evolución.
- Reutilizar tablero, motor y providers ya existentes en el monorepo.

---

## Los dos niveles de "jugar con tu estilo"

Clonar un estilo tiene dos implementaciones muy distintas en coste. Este documento propone **empezar por la barata (Nivel 1)** y dejar la cara (Nivel 2) como evolución explícita.

### Nivel 1 — Perfil estadístico + Stockfish sesgado (**MVP, on-device, sin backend**)

Se extrae un **`StyleProfile`** de las partidas (ver más abajo) y se juega con un **motor de selección** que:

1. **Aproxima la fuerza** del jugador: limita la profundidad/`Skill Level` de Stockfish al ELO objetivo e **inyecta errores** con la **frecuencia y magnitud** que el jugador comete realmente (su tasa de blunders/inaccuracies por fase de la partida).
2. **Sesga la elección** hacia el estilo: entre las jugadas candidatas de Stockfish, **pondera** según el repertorio y tendencias del perfil (p. ej. prefiere enroque corto temprano, cambios de damas, empujes de peón en el flanco de rey… si eso es lo que hace el jugador).
3. **Usa el libro de aperturas propio**: en las primeras N jugadas reproduce el **repertorio real** del jugador (con sus frecuencias), no la teoría "óptima".

Es **una aproximación**, no un clon exacto — pero es **jugable hoy, en el dispositivo, gratis** y ya se "siente" personalizado (sobre todo en aperturas y nivel de error).

### Nivel 2 — Modelo neuronal personalizado (**evolución, requiere nube/GPU**)

Un modelo tipo **Maia** (red de política entrenada para *predecir la jugada humana* a un ELO dado) **afinado (fine-tuning)** con las partidas del usuario, de modo que prediga *tu* jugada, no la del humano promedio de tu rating. Esto es lo que de verdad "clona" un estilo.

- Entrenamiento **en backend con GPU** (no en el móvil): pipeline de fine-tuning por usuario.
- Inferencia: o bien en la nube (endpoint), o exportando el modelo afinado a un formato ligero (ONNX/TF-Lite) para correr on-device.
- Es aquí donde el **"auto-entrenamiento"** cobra su sentido más fuerte: re-fine-tuning periódico con las partidas nuevas.

> **Decisión de producto clave**: el MVP entrega valor real con el **Nivel 1** sin backend. El Nivel 2 es una apuesta de I+D separada (coste, infra, privacidad) que **no bloquea** el lanzamiento.

---

## `StyleProfile` — qué se extrae de las partidas

Modelo derivado (cacheado por jugador+plataforma) que alimenta al Nivel 1 y sirve de features al Nivel 2:

```ts
// libs/models/src/lib/style-profile.model.ts

interface StyleProfile {
  id: string;                       // p.ej. 'lichess:magnus' | 'me'
  source: { platform: ChessPlatform; username: string } | 'self';
  gamesAnalyzed: number;
  updatedAt: string;                // ISO — para el auto-entrenamiento

  // Fuerza
  elo: { blitz?: number; rapid?: number; classical?: number; estimated: number };

  // Repertorio (libro propio con frecuencias)
  openings: {
    asWhite: OpeningStat[];         // ECO / primeras jugadas + winrate + frecuencia
    asBlack: OpeningStat[];
  };

  // Tendencias de juego (0..1 salvo indicado)
  tendencies: {
    aggression: number;             // sacrificios/ataques al rey vs. juego sólido
    tacticalVsPositional: number;   // 0 posicional … 1 táctico
    castlingSpeed: number;          // qué tan pronto enroca
    queenTradeAffinity: number;     // propensión a cambiar damas
    pawnPushFlank: 'king' | 'queen' | 'center' | 'mixed';
    endgameStrength: number;        // rendimiento relativo en finales
    timeTrouble: number;            // tendencia a apuros de tiempo (si hay clocks)
  };

  // Perfil de error (clave para "fallar donde tú fallas")
  errors: {
    blunderRate: ByPhase;           // % de blunders por fase (apertura/medio/final)
    inaccuracyRate: ByPhase;
    avgCentipawnLoss: ByPhase;      // ACPL por fase → calibra la "fuerza sentida"
  };
}

type ByPhase = { opening: number; middlegame: number; endgame: number };

interface OpeningStat {
  eco?: string;
  sanLine: string[];               // primeras jugadas
  frequency: number;               // 0..1
  score: number;                   // winrate del jugador con esa línea
}
```

El **cálculo del perfil** usa el mismo PGN parseado que [Game Analytics](./GAME_ANALYTICS.md)/`game-reporter`. El **ACPL / blunder rate** requiere evaluar posiciones con **Stockfish** (batch, offline) — reutiliza [`stockfish-analysis.service.ts`](../../libs/stockfish-wasm/src/lib/stockfish-analysis.service.ts).

---

## Alcance funcional

### 1. Fuente del rival

- **Yo mismo**: usa las partidas ya sincronizadas del usuario (Game Analytics) → perfil `self`.
- **Otro jugador**: introducir un `username` de lichess/chess.com → descarga sus partidas públicas → perfil clonado.
- **PGN pegado/importado**: construir un perfil desde un `.pgn` suelto (sin cuenta).

### 2. Configurar la partida de sparring

| Opción | Detalle |
|--------|---------|
| Rival | Perfil a enfrentar (yo / clon / importado) |
| Mi color | Blancas / Negras / Aleatorio |
| Fuerza | Usar el ELO del perfil, o forzar un objetivo (±) |
| Cadencia | Sin reloj / blitz / rapid (opcional; el reloj no es el foco) |
| Apertura | Libre, o pedir que el rival juegue una de **sus** líneas frecuentes |

### 3. Jugar

- Tablero de juego reutilizando [`@chesspark/board`](../../libs/board/src/lib/board/board.component.ts) (movimiento libre de piezas, legalidad con `chess.js`).
- El rival responde según el **motor de estilo** (Nivel 1) con una **latencia natural** (no instantánea).
- **Rendirse / tablas / reiniciar**.

### 4. Post-partida

- **Resumen**: quién se pareció a qué; dónde el rival "jugó como tú" (aperturas, un error típico reproducido).
- **Enviar al [Analizador de Partidas](./ANALIZADOR_PARTIDAS.md)** para estudiar la partida jugada (variantes, comentarios, dibujos).
- **Guardar la partida** en el historial local.

### 5. Auto-entrenamiento

- Al **sincronizar partidas nuevas** (o al terminar una partida en la app), marcar el perfil como *stale* y **recalcular** el `StyleProfile` en segundo plano.
- Mostrar **cómo evoluciona el perfil** ("tu agresividad subió", "nuevas líneas en tu repertorio").
- (Nivel 2) Disparar **re-fine-tuning** del modelo neuronal cuando hay suficientes partidas nuevas.

---

## Flujo de usuario

```
[Usuario abre "Sparring personalizado"]
        ↓
[Elige rival: yo mismo | clonar @usuario | PGN]
        ↓
[¿Perfil en caché? ── no ──► Descarga partidas (providers) + calcula StyleProfile
        │                     (parseo PGN + evaluación Stockfish en batch)]
        ▼ sí
[Configura color / fuerza / apertura]
        ↓
[Juega vs. motor de estilo (Nivel 1: Stockfish sesgado + libro propio)]
        ↓
[Fin de partida → resumen "jugó como tú aquí" → analizar / guardar]
        ↓
[Sincroniza partidas nuevas ► perfil se recalcula (auto-entrenamiento)]
```

---

## Diseño técnico

### Ubicación en el proyecto

- **Nueva página**: `apps/chessColate/src/app/pages/sparring/` (nombre a alinear), registrada en [`app.routes.ts`](../../apps/chessColate/src/app/app.routes.ts).
- **Nueva lib**: `libs/style-engine` (`@chesspark/style-engine`) — extracción del `StyleProfile` + **motor de selección de jugadas** del Nivel 1.
- **Reutiliza**:
  - `@chesspark/chess-com-provider` / `@chesspark/lichess-provider` (de [Game Analytics](./GAME_ANALYTICS.md)) para traer partidas.
  - `@chesspark/game-reporter` para el parseo/normalización PGN.
  - [`@chesspark/stockfish-wasm`](../../libs/stockfish-wasm/src/lib/) para (a) el ACPL/blunder-rate offline y (b) generar jugadas candidatas en juego.
  - [`@chesspark/board`](../../libs/board/src/lib/board/board.component.ts) para el tablero jugable.
  - `libs/models` para `ChessGame` (ya definido) + el nuevo `StyleProfile`.
  - `libs/state` / `@capacitor/preferences` para cachear perfiles.

### Motor de selección — Nivel 1 (pseudocódigo)

```ts
function chooseMove(fen: string, profile: StyleProfile, ply: number): string {
  // 1) Libro propio en la apertura
  if (ply < profile.openingDepth) {
    const bookMove = sampleFromRepertoire(fen, profile.openings);
    if (bookMove) return bookMove;                 // reproduce SUS líneas con SUS frecuencias
  }

  // 2) Candidatas del motor limitado al ELO objetivo
  const candidates = stockfish.multiPV(fen, {
    skillLevel: eloToSkill(profile.elo.estimated),
    movetimeMs: humanizedThinkTime(profile),
    lines: 4,
  });

  // 3) ¿Toca "fallar como él"? según blunderRate de la fase actual
  const phase = phaseOf(fen);
  if (roll(profile.errors.blunderRate[phase])) {
    return pickWorseButPlausible(candidates);      // error realista, no aleatorio
  }

  // 4) Sesgo de estilo: pondera candidatas por afinidad al perfil
  return weightedPick(candidates, m => styleAffinity(m, fen, profile.tendencies));
}
```

Puntos delicados:
- **`eloToSkill` + inyección de error** deben calibrarse contra el **ACPL real** del jugador, no solo contra `Skill Level` (que por sí solo no reproduce el *patrón* de error).
- **`pickWorseButPlausible`**: el error debe parecer humano (una jugada natural pero inferior), no un movimiento absurdo.
- **`styleAffinity`**: heurísticas explicables (enroque, cambios de dama, empujes de flanco, motivos tácticos) derivadas de `tendencies`.
- **Determinismo/semilla**: para poder reproducir/depurar partidas (y por los blockers de `Math.random` en ciertos entornos), usar un RNG sembrado por partida.

### Nivel 2 — pipeline neuronal (esbozo, futuro)

```
Partidas (PGN)  →  dataset (posición → jugada)  →  fine-tune sobre base Maia (GPU, backend)
                                                        ↓
                                     modelo por-usuario  →  inferencia (endpoint | ONNX on-device)
```

- Requiere **backend** (colas de entrenamiento, storage de modelos), **coste de GPU** y política de **privacidad** (son partidas/estilo de una persona).
- Fuera del MVP; se documenta aquí para no cerrar la puerta al diseñar el Nivel 1.

### Persistencia

- **Perfiles** (`StyleProfile`) cacheados por `id` con `updatedAt` (para el auto-entrenamiento).
- **Partidas de sparring** guardadas en historial local (PGN), enlazables al [Analizador](./ANALIZADOR_PARTIDAS.md).
- (Futuro) Sincronización en la nube de perfiles/partidas con la cuenta.

### Casos borde

- **Pocas partidas** → perfil poco fiable: avisar y caer a valores por defecto por ELO (Maia genérico conceptual).
- **Rating mixto** (blitz vs clásico muy distintos) → perfilar por cadencia o dejar elegir.
- **Cálculo de ACPL costoso** (muchas posiciones × Stockfish) → hacerlo **en batch, incremental** (solo partidas nuevas) y en segundo plano.
- **Privacidad al "clonar a otro"**: solo partidas **públicas**; ser transparentes sobre qué se descarga.
- **Rendimiento en móvil**: Stockfish en juego + evaluación batch pueden competir por el worker → serializar/priorizar.

---

## Instrumentación (analytics)

Reusa el `AnalyticsService` existente ([catálogo](../implementado/OBSERVABILITY_TRACKING.md)). Eventos sugeridos:

| Evento | Cuándo | Params |
|--------|--------|--------|
| `sparring_opened` | se abre la pantalla | `source` |
| `sparring_profile_built` | se calcula un perfil | `subject` (`self`/`clone`/`pgn`), `games_analyzed` |
| `sparring_game_started` | empieza una partida | `opponent_elo`, `my_color`, `opening_forced` |
| `sparring_game_finished` | termina | `result`, `moves_count`, `resigned` |
| `sparring_style_matched` | el rival reproduce una tendencia del perfil | `trait` (`opening`/`blunder`/`aggression`) |
| `sparring_profile_retrained` | auto-entrenamiento recalcula | `new_games`, `elo_delta` |
| `sparring_sent_to_analyzer` | manda la partida al analizador | — |

---

## Consideraciones UX

- **Explicar qué es** sin sobrevender: "un rival que aproxima tu nivel y tus manías", no "una IA perfecta que eres tú".
- **Mostrar el perfil** de forma legible (radar de tendencias, top aperturas, tasa de error por fase) — es contenido interesante por sí mismo y conecta con [Game Analytics](./GAME_ANALYTICS.md).
- **Momentos "ajá"**: señalar en vivo/post-partida cuándo el rival "jugó como tú" (misma apertura, mismo tipo de error) — es la magia de la feature.
- **Tiempo de pensar humano**: que el rival no responda instantáneo; da sensación de partida real.
- **Onboarding del clon**: al clonar a alguien, dejar claro que son partidas públicas y cuántas se usaron.
- **Auto-entrenamiento transparente**: notificar sutilmente "tu sparring aprendió de tus últimas N partidas".

---

## Métricas de éxito

- **Adopción**: nº de `sparring_profile_built` y partidas jugadas por usuario.
- **Retención**: usuarios que vuelven a jugar sparring (hábito de "entrenar contra mí mismo").
- **Percepción de realismo**: proporción de partidas con `sparring_style_matched` (¿de verdad se siente personalizado?).
- **Auto-entrenamiento**: cuántos perfiles se recalculan (`sparring_profile_retrained`) — señal de uso continuado.
- **Puente a estudio**: `sparring_sent_to_analyzer` (la partida deja valor de aprendizaje).

---

## Alcance inicial (MVP) — solo Nivel 1

1. Página "Sparring personalizado" enlazada desde menú/home.
2. Construir `StyleProfile` desde las **partidas propias** ya sincronizadas (reusando providers de [Game Analytics](./GAME_ANALYTICS.md)) + **PGN pegado**.
3. **Perfil visible**: ELO estimado, top aperturas por color, tendencias básicas, tasa de error por fase.
4. **Motor de estilo Nivel 1**: libro de aperturas propio + Stockfish limitado al ELO + inyección de error calibrada con ACPL + sesgo de estilo básico.
5. **Jugar** una partida contra el perfil (elegir color/fuerza) sobre `@chesspark/board`.
6. **Post-partida**: resumen "jugó como tú aquí" + guardar + (si existe) mandar al [Analizador](./ANALIZADOR_PARTIDAS.md).
7. **Auto-entrenamiento básico**: recalcular perfil (incremental) al sincronizar partidas nuevas.
8. Eventos de analytics.

## Fuera de alcance inicial

- **Nivel 2** (modelo neuronal personalizado tipo Maia fine-tuneado) y su infra de GPU/backend.
- **Clonar a otro jugador** por username (empezar solo con "yo mismo"/PGN; el clon es iteración siguiente).
- **Inferencia on-device de un modelo entrenado** (ONNX/TF-Lite).
- **Relojes/cadencias competitivas** como foco (el sparring prioriza estilo, no gestión de tiempo).
- **Sincronización en la nube** de perfiles.

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **¿MVP = Nivel 1 (estadístico + Stockfish sesgado), verdad?** Confirmar que el clon neuronal (Nivel 2) es I+D posterior y **no** bloquea el lanzamiento.
2. **Alcance del clon**: ¿el MVP solo perfila "a mí mismo" (+PGN), o entra ya "clonar a @usuario"? (lo segundo suma descarga de partidas ajenas + privacidad).
3. **Calibración de la fuerza**: ¿basta `Skill Level` de Stockfish, o invertimos en calibrar contra el **ACPL real** por fase (más fiel, más costoso de calcular)?
4. **Coste de evaluar ACPL** en móvil: ¿lo calculamos on-device en batch, lo limitamos a N partidas recientes, o lo dejamos para cuando haya backend?
5. **Dependencia de [Game Analytics](./GAME_ANALYTICS.md)**: ¿este sparring espera a que existan los providers, o incorporamos un mini-importador propio para no bloquearnos?
6. **Nombre y entrada**: ¿"Sparring", "Juega contra ti mismo", "Rival personalizado"? ¿Entrada desde home, menú, o desde la pantalla de Game Analytics?
7. **Expectativa de producto**: cómo comunicar que Nivel 1 es *aproximación* para no prometer un clon exacto que solo el Nivel 2 daría.

---

## Dependencias técnicas

- `@chesspark/chess-com-provider` / `@chesspark/lichess-provider` (de [Game Analytics](./GAME_ANALYTICS.md)) para ingesta de partidas + caché.
- `@chesspark/game-reporter` para parseo/normalización PGN.
- [`@chesspark/stockfish-wasm`](../../libs/stockfish-wasm/src/lib/) para ACPL/blunder-rate offline y generación de candidatas en juego (`multiPV`, `Skill Level`, `movetime`).
- [`@chesspark/board`](../../libs/board/src/lib/board/board.component.ts) + `chess.js` para el tablero jugable y la legalidad.
- `libs/models` — nuevo `StyleProfile` junto al `ChessGame` existente.
- `libs/state` / `@capacitor/preferences` para cachear perfiles y partidas de sparring.
- `AnalyticsService` existente para la instrumentación.
- (Nivel 2, futuro) **Backend con GPU** para fine-tuning tipo Maia + `onnxruntime-web`/TF-Lite para inferencia.
</content>
</invoke>
