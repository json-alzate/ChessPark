# Puzzle Feed — Feature Document

## Concepto

Feed vertical de pantalla completa con scroll infinito, al estilo TikTok/Reels. Cada "card" del feed es un puzzle de ajedrez: el usuario lo ve, lo intenta resolver, interactúa (like, guardar, skip) y desliza hacia arriba para pasar al siguiente. El algoritmo elige el próximo puzzle basándose en el ELO del usuario, sus temas favoritos y su historial reciente.

La idea central es combinar el **consumo pasivo adictivo** de las redes sociales modernas con el **aprendizaje activo** que requiere resolver un puzzle de ajedrez. El usuario no tiene que buscar ni elegir — el feed le trae contenido relevante de forma continua.

---

## Flujo de usuario

```
[Usuario abre la app → pestaña "Feed"]
         ↓
[Puzzle card carga en pantalla completa]
  → Tablero con la posición del puzzle
  → Tema, ELO y quién lo compartió (si aplica)
  → Contador de soluciones: "1.2k jugadores lo resolvieron hoy"
         ↓
┌────────────────────────────────────┐
│  ¿El usuario intenta resolverlo?   │
├──────────────┬─────────────────────┤
│     SÍ       │         NO          │
│              │                     │
▼              ▼                     │
Hace la    Desliza arriba             │
jugada     (skip) → siguiente         │
  │        puzzle                    │
  ▼                                  │
¿Correcto?                           │
  ├── SÍ → animación ✓ → like        │
  │        automático →              │
  │        habilita swipe →          │
  │        siguiente puzzle          │
  └── NO → resalta error →           │
           muestra pista (opcional)  │
           → puede reintentar o      │
             deslizar para pasar     │
```

---

## Anatomía de una card

```
┌─────────────────────────────┐
│  ♟ Fork · ⭐ 1 450 ELO      │  ← tema + dificultad
│  @community · 2h ago        │  ← origen del puzzle
├─────────────────────────────┤
│                             │
│                             │
│       [ TABLERO ]           │  ← ocupa ~60% de la pantalla
│    posición del puzzle      │
│                             │
│                             │
├─────────────────────────────┤
│  "Blancas juegan y ganan"   │  ← instrucción
├─────────────────────────────┤
│                             │
│   [ INTENTAR ]  [ SKIP ]    │  ← acciones principales
│                             │
├─────────────────────────────┤
│  ❤️ 2.3k   🔖 891   ▶️ 12k  │  ← likes · guardados · jugadas
└─────────────────────────────┘
         ↑ desliza arriba para siguiente
```

**Barra lateral derecha** (como TikTok):
- ❤️ Like / quitar like
- 🔖 Guardar en colección personal
- 🔗 Compartir puzzle
- ℹ️ Ver análisis / solución completa (colapsa el tablero hacia abajo)

---

## Algoritmo de selección

El feed no es aleatorio. Cada vez que se necesita el próximo puzzle se aplica este orden de prioridad:

1. **ELO match**: puzzles dentro de ±150 ELO del usuario en el tema activo.
2. **Temas frecuentes**: primero los temas que el usuario más ha jugado en las últimas 2 semanas.
3. **Sin repetición reciente**: excluir puzzles resueltos en los últimos 7 días.
4. **Diversidad**: si los últimos 3 puzzles son del mismo tema, forzar un tema diferente.
5. **Novedad social**: si un puzzle tiene un pico de `timesPlayed` en las últimas 24h, se inyecta en el feed aunque no sea de un tema prioritario (equivalente al "trending" de TikTok).

```typescript
interface FeedCriteria {
  userElo: number;
  eloRange: number;          // default: 150
  recentThemes: string[];    // temas más jugados (últimas 2 semanas)
  excludePuzzleIds: string[]; // jugados en los últimos 7 días
  lastThemes: string[];      // los últimos 3 temas mostrados (para diversidad)
  injectTrending: boolean;   // activar inyección de puzzles trending
}
```

---

## Modelos de datos

### FeedItem

```typescript
interface FeedItem {
  puzzle: Puzzle;
  source: 'algorithm' | 'trending' | 'followed-user' | 'public-plan';
  sharedBy?: string;          // uid si viene de un plan público
  stats: FeedItemStats;
  userInteraction: FeedItemInteraction;
}

interface FeedItemStats {
  likesCount: number;
  savedCount: number;
  solvedCount: number;        // veces que fue resuelto en el feed
  solvedTodayCount: number;   // para mostrar urgencia social
}

interface FeedItemInteraction {
  liked: boolean;
  saved: boolean;
  solved: boolean;
  skipped: boolean;
  timeSpentMs: number;
}
```

### FeedSession (estado local de la sesión)

```typescript
interface FeedSession {
  items: FeedItem[];
  currentIndex: number;
  solvedInSession: number;
  skippedInSession: number;
  startedAt: Date;
}
```

El estado de sesión vive en el cliente (NgRx). Los eventos de interacción se persisten en Firestore de forma asíncrona en background (no bloquean el scroll).

---

## Stack técnico

### Componente de scroll

| Necesidad | Herramienta | Motivo |
|---|---|---|
| Scroll vertical full-screen | `Swiper` (ya en el proyecto) | Ya instalado, soporte vertical y virtual slides |
| Precarga de slides | `SwiperVirtualModule` | Renderiza solo 3 slides en DOM, el resto virtual |
| Snap por card | `slidesPerView: 1` + `freeMode: false` | Una card exacta por swipe |
| Infinite load | `(reachEnd)` de Swiper | Cargar más puzzles cuando quedan 3 slides |

### Tablero

`cm-chessboard` (ya en el proyecto vía `chess-extension`). Al resolver correctamente, reproducir la solución animada antes de habilitar el swipe al siguiente slide.

### Persistencia

| Evento | Donde persiste | Cuándo |
|---|---|---|
| Like / unlike | Firestore `planInteractions` (modelo existente) | Inmediato |
| Guardado | Firestore `savedPuzzles` (nueva colección) | Inmediato |
| Resuelto | Firestore `userPuzzles` (modelo existente) | On swipe |
| Skip | Solo local (FeedSession) | No se persiste |
| Stats globales | Firestore `puzzleStats` (nueva colección) | Batch cada N eventos |

---

## Flujo técnico

```
[Usuario entra al Feed]
         │
         ▼
FeedService.initSession(userProfile)
  → consulta puzzles con FeedCriteria
  → precarga los primeros 10 items
  → FeedSession guardado en NgRx
         │
         ▼
FeedComponent renders Swiper vertical
  → slide 0: puzzle actual (tablero activo)
  → slides 1-2: pre-renderizados (tablero estático, sin interacción)
         │
         ▼
Usuario interactúa con el tablero
  → BoardComponent emite (movePlayed)
  → FeedComponent evalúa si es correcto
  → SÍ: animación de solución → habilita swipe
  → NO: muestra feedback → opción de reintentar o skip
         │
         ▼
Usuario desliza hacia arriba
  → FeedService.recordInteraction(item, interaction)  ← async, no bloquea
  → Swiper avanza al siguiente slide
  → Si quedan < 3 slides → FeedService.loadMore()
         │
         ▼
FeedService.loadMore()
  → aplica FeedCriteria actualizado (excluye puzzles ya vistos)
  → agrega nuevos FeedItems al NgRx store
  → Swiper renderiza nuevos slides virtuales
```

---

## Diferencias con el modo Infinity actual

| Aspecto | Modo Infinity (actual) | Puzzle Feed (nuevo) |
|---|---|---|
| Layout | Pantalla de puzzle estándar | Full-screen, una card a la vez |
| Navegación | Botón "siguiente" explícito | Swipe vertical natural |
| Selección | Aleatoria por ELO | Algorítmica (ELO + temas + trending) |
| Social | Sin interacción social | Like, save, compartir |
| Sesión | Plan con bloques definidos | Sin límite, session infinita |
| Contexto del puzzle | Mínimo | Tema, ELO, stats sociales, quién compartió |

---

## Experiencia de "solución viral"

Cuando un puzzle se resuelve correctamente, si el usuario da like (o si el sistema detecta que fue muy rápido = "fácil para su ELO"), se puede mostrar un botón **"Compartir mi solución"** que genera una animación del tablero (la secuencia de jugadas) y la exporta como video/GIF para compartir fuera de la app. Esto cierra el loop viral: el usuario comparte en Instagram/WhatsApp → otros descargan la app para resolver el mismo puzzle.

---

## Consideraciones UX

- **Sin autoplay de solución**: a diferencia de TikTok con video, no reproducir la solución automáticamente. El usuario debe intentar o skip conscientemente.
- **Tiempo en pantalla**: registrar `timeSpentMs` por card para que el algoritmo aprenda — si el usuario pasa mucho tiempo en puzzles de Fork, es porque le gustan.
- **Sin distracciones**: en la card activa, ocultar navegación inferior. Solo visible el tablero + acciones laterales + swipe hint.
- **Swipe hint inicial**: primera vez que el usuario entra, mostrar una animación de dedo deslizando hacia arriba (desaparece tras el primer swipe).
- **Contador social**: "X jugadores lo resolvieron hoy" crea urgencia y valida que el puzzle es interesante.

---

## Fases de implementación

### Fase 1 — MVP Feed

- [ ] Nueva ruta `/feed` en ChessColate
- [ ] `FeedService` con lógica de `FeedCriteria` y carga inicial
- [ ] `FeedComponent` con Swiper vertical full-screen y slides virtuales
- [ ] Integración de `cm-chessboard` en modo feed (sin controles extra)
- [ ] Evaluación de jugadas y animación de solución al resolver
- [ ] Swipe para pasar al siguiente (con precarga automática)
- [ ] Acciones básicas: like y guardar (contra Firestore)
- [ ] Registro de interacciones en background

### Fase 2 — Algoritmo y social

- [ ] Algoritmo de selección completo (`FeedCriteria` con temas frecuentes, diversidad, trending)
- [ ] Colección `puzzleStats` en Firestore con batch updates
- [ ] Visualización de stats por card (likesCount, solvedTodayCount)
- [ ] Tabs en el feed: "Para ti" / "Trending" / "Siguiendo"
- [ ] Perfil de usuario como fuente de feed (ver puzzles que otros guardaron o publicaron)

### Fase 3 — Viralidad

- [ ] Exportar solución como animación (canvas → video/GIF)
- [ ] Compartir puzzle hacia redes externas (Web Share API)
- [ ] Deep link al puzzle compartido (abre la app directo en ese puzzle)
- [ ] Notificación push cuando un puzzle guardado llega a X likes
