# Chess Runner — Feature Document

## Concepto

Mini-juego estilo _Chrome Dinosaur_ que se ejecuta **antes de resolver un puzzle**. Un personaje pixel-art corre horizontalmente y debe saltar (o esquivar) las piezas de ajedrez del puzzle que aparecen como obstáculos. Cada tipo de pieza requiere una mecánica de salto diferente. Al superar todos los obstáculos, el tablero aparece y el timer del puzzle comienza.

El objetivo doble es: **gamificar el acceso al puzzle** y **familiarizar al jugador con las piezas involucradas** antes de enfrentarlas en el tablero.

---

## Flujo de usuario

```
[Puzzle seleccionado por el usuario]
         ↓
[Pantalla Chess Runner carga]
  → personaje pixel-art entra corriendo desde la izquierda
  → piezas del puzzle aparecen como obstáculos desde la derecha
  → jugador salta/esquiva cada pieza con su mecánica específica
         ↓
[Última pieza superada]
  → animación de transición: personaje llega al borde, tablero hace zoom-in
  → puzzle aparece con countdown timer activo
         ↓
[Resolver puzzle en tiempo]
```

---

## Mecánicas de salto por pieza

Cada pieza-obstáculo tiene un **hint visual** claro que señala la mecánica requerida antes de que llegue al jugador.

| Pieza | Mecánica | Input | Hint visual |
|-------|----------|-------|-------------|
| **Peón** | Salto básico | 1 tap | Flecha simple hacia arriba |
| **Torre** | Deslizarse (agacharse) | Swipe ↓ | Flecha apuntando abajo, la torre es alta con hueco inferior |
| **Alfil** | Salto diagonal | Swipe ↗ diagonal | Flechas diagonales animadas |
| **Caballo** | Salto con pausa en el aire | Tap → hold en el aire → tap | Dos arcos dibujados (L-shape) |
| **Dama** | Doble salto | 2 taps rápidos | Doble flecha ↑↑ |
| **Rey** | Salto corto y preciso | Tap en ventana breve | Ventana de tiempo resaltada, flecha pequeña |

### Fail state por obstáculo

Opción recomendada **(arcade, no punitivo)**: si el personaje toca un obstáculo, tropieza brevemente y la misma pieza reaparece una vez más para dar una segunda oportunidad. No reinicia todo el run. Esto evita frustración antes del puzzle principal.

---

## Piezas en el runner

Se usan **todas las piezas del puzzle**, blancas y negras. Si hay duplicadas (ej. 4 peones), aparecen en el run de forma consecutiva o en pareja cercana.

El orden puede ser:
- **Aleatorio** (recomendado para variedad)
- **Por dificultad creciente**: peones primero, dama y rey al final

### Barra de progreso

Arriba de la pantalla, miniaturas de las piezas pendientes de saltar. Al superar cada una, se tacha o desaparece de la barra.

---

## Transición al puzzle

Al superar el último obstáculo:

1. El personaje corre hasta el borde derecho de la pantalla.
2. Aparece un tablero de ajedrez al fondo que hace zoom-in (transición CSS o Phaser camera zoom).
3. El personaje "entra" al tablero.
4. Fade-in al puzzle con las piezas ya posicionadas.
5. El countdown timer empieza a correr.

---

## Stack técnico recomendado

### Motor de juego: Phaser.js (v3)

**Por qué Phaser y no canvas puro o PixiJS:**

- El runner necesita: game loop, física de saltos (arcos de parábola), detección de colisiones, animaciones de sprite, y spawning de obstáculos. Implementar esto desde cero en canvas puro es viable pero costoso de mantener.
- **PixiJS** es solo un renderer (WebGL/Canvas) sin física ni colisiones integradas — requiere más código manual para el mismo resultado.
- **Phaser 3 Arcade Physics** resuelve el salto, la gravedad, la colisión y las animaciones de sprite con pocas líneas. Es exactamente lo que necesita un runner 2D.
- Phaser corre en un elemento `<canvas>` estándar que se embebe en cualquier componente Angular sin conflictos con Ionic.
- Se puede **lazy-load** el módulo completo para no impactar el bundle principal.

**Bundle size:** ~1MB minificado. Con lazy-loading en la ruta del runner, no afecta la carga inicial de la app.

**Integración con Angular/Ionic:**

```
IonPage
  └── IonContent
        └── <canvas #gameCanvas> ← Phaser se monta aquí
```

El componente Angular crea la instancia de Phaser en `ngAfterViewInit` pasando el canvas como target. Al destruirse el componente, se llama `game.destroy()`.

**Instalación:**

```bash
npm install phaser
```

Para lazy-loading en Angular, importar Phaser dinámicamente dentro del componente:

```ts
// en ngAfterViewInit
const Phaser = await import('phaser');
this.game = new Phaser.Game({ canvas: this.canvasRef.nativeElement, ... });
```

---

### Input / Gestos: Phaser Input + Ionic GestureController

**Phaser Input** maneja el input dentro del canvas del juego (taps, swipes durante el run). Funciona con mouse y touch de forma nativa.

**Ionic GestureController** se usa **fuera del canvas**: para la transición al puzzle, el botón de "ya estoy listo" si se quiere añadir, o controles UI sobre el juego.

Mecánicas de input que Phaser maneja:
- **Tap / click**: `this.input.on('pointerdown', ...)`
- **Double tap**: detección manual con timestamp entre dos `pointerdown` (< 300ms)
- **Swipe diagonal / swipe down**: delta de posición entre `pointerdown` y `pointerup`
- **Hold en el aire** (caballo): combinación de `pointerdown` + tiempo transcurrido sin `pointerup`

---

### Sonido: Howler.js

Ya instalado en el proyecto. Se usa para:
- Sonido de salto (por tipo de pieza)
- Sonido de colisión / tropiezo
- Fanfare de transición al puzzle

---

### Assets del personaje: Sprite sheet pixel art

El personaje requiere un sprite sheet con al menos 4 estados de animación:

| Estado | Frames sugeridos |
|--------|-----------------|
| `idle` | 2–4 frames |
| `run` | 4–6 frames |
| `jump` | 3–5 frames |
| `hurt` | 2–3 frames |
| `slide` (agacharse) | 2–3 frames |

**Herramientas para crear el sprite:**
- [Piskel](https://www.piskelapp.com/) — editor pixel art online, exporta sprite sheet PNG
- [Aseprite](https://www.aseprite.org/) — herramienta de escritorio, referencia del sector
- [LDtk](https://ldtk.io/) — opcional para el mapa del nivel si se quiere un tilemap

Las piezas de ajedrez como obstáculos se pueden renderizar usando los **SVGs del cm-chessboard** ya en el proyecto, escalados y animados con CSS o Phaser GameObjects.

---

### Física del salto (Phaser Arcade Physics)

Parámetros clave a configurar por tipo de salto:

```
// Gravedad global del runner
gravity: 800

// Por tipo de salto:
Peón:    velocityY = -500  (arco estándar)
Dama:    velocityY = -400, segundo salto mid-air = -400
Caballo: velocityY = -350, pausa mid-air (gravity = 0 por 200ms), luego -300
Rey:     velocityY = -250  (arco pequeño, ventana de timing ajustada)
```

El slide (Torre) no usa física de salto — activa una animación de agacharse y reduce el hitbox del personaje temporalmente.

---

## Arquitectura del componente Angular

```
chess-runner/
  ├── chess-runner.component.ts   ← monta Phaser, recibe puzzle como input
  ├── chess-runner.component.html ← solo <canvas> + overlay de progreso
  ├── scenes/
  │   ├── preload.scene.ts        ← carga assets (sprites, sonidos, SVGs)
  │   ├── runner.scene.ts         ← lógica principal del juego
  │   └── transition.scene.ts     ← animación de entrada al tablero
  └── chess-runner.module.ts      ← lazy module, importa Phaser
```

El componente recibe el puzzle como `@Input()` y emite un `@Output() puzzleReady` cuando el runner termina para que el componente padre monte el tablero.

---

## Pendientes antes de implementar

- [ ] Decidir si el tiempo del runner descuenta segundos del timer del puzzle (integración de dificultad)
- [ ] Definir si hay tutorial la primera vez (onboarding de mecánicas de salto)
- [ ] Crear o encargar los sprites pixel-art del personaje
- [ ] Decidir si las piezas-obstáculo usan los SVGs del proyecto o sprites pixel-art nuevos
- [ ] Confirmar si el modo runner es siempre activo o es un toggle en settings
