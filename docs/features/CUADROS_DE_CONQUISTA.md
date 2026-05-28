# Cuadros de Conquista — Feature Document

## Concepto

Cada usuario tiene un **tablero-fortaleza** de 64 casillas. Cada casilla representa un puzzle de ajedrez que el usuario ha resuelto en sus rutinas de entrenamiento. Otros usuarios pueden **atacar** ese tablero seleccionando casillas e intentando resolver los puzzles en menos tiempo que el dueño original.

La mecánica es asíncrona — el defensor no necesita estar conectado. Está inspirada en el ciclo de juego de _Clash of Clans_: construir, defender, atacar.

---

## Construcción del tablero (Defensa)

### Cómo se llena una casilla

1. El usuario resuelve un puzzle dentro de una **rutina de entrenamiento**.
2. Si lo resuelve correctamente dentro de la rutina (no solo intenta, sino que pasa), ese puzzle queda disponible en su **banco de conquistas**.
3. Desde el banco, el usuario puede **elegir manualmente** en qué casilla de su tablero lo coloca.
4. Si el usuario no asigna manualmente, el sistema puede **sugerir automáticamente** una posición basándose en el tema del puzzle y los temas ya presentes en el tablero.

### Distribución de temas

- No hay una distribución fija de temas por zona del tablero — las casillas reflejan el historial real del usuario.
- El sistema genera una distribución visual coherente según los temas que el usuario tenga en su banco (si tiene muchos mates, habrá más casillas con mates, etc.).
- Cada casilla muestra su **tema** (visible para el atacante) pero no el puzzle específico ni el tiempo del defensor.

### Estado del tablero

| Estado | Descripción |
|---|---|
| **Vacía** | Casilla sin puzzle asignado. No puede ser atacada. |
| **Ocupada** | Tiene un puzzle y tiempo de referencia del defensor. Atacable. |
| **Conquistada** | Fue resuelta más rápido por un atacante. ELO del puzzle disponible se reduce. |
| **Bloqueada** | Tiene un poder activo del defensor (ej. Piedra). Visible pero no seleccionable. |

### Requisito mínimo para ser atacable

El tablero debe tener al menos **32 casillas ocupadas** para aparecer en el sistema de matchmaking y ser elegible para ataques.

---

## Mecánica de ataque (Raid)

### Flujo de un raid

```
[Atacante selecciona un tablero rival]
         ↓
[Ve el tablero: temas visibles, ELOs visibles, trampas ocultas]
  → Casillas con poder "Piedra" aparecen visualmente bloqueadas
  → El resto de las casillas no revela qué puzzle hay ni el tiempo del defensor
         ↓
[Atacante selecciona X casillas para atacar en este raid]
  → El orden de ataque lo elige el propio atacante
         ↓
[Por cada casilla seleccionada:]
  → Se activa el poder del defensor (si hay uno oculto) — ej. Strike automático
  → O se presenta el puzzle del defensor
  → El atacante puede usar sus poderes antes de empezar a resolver
  → Resuelve el puzzle sin conocer el tiempo de referencia del defensor
         ↓
[Al terminar todas las casillas del raid: resumen de resultados]
  → Casillas conquistadas / no conquistadas / strikes recibidos
```

### Condición de conquista por casilla

- **Conquista:** El atacante resuelve el puzzle en **menos tiempo** que el defensor original.
- **No conquista:** El atacante no resuelve o tarda más tiempo que el defensor.
- El atacante **nunca conoce** el tiempo del defensor durante el raid — solo se entera del resultado al final de cada casilla.

### Consecuencia de conquista

Cuando una casilla es conquistada:
- El **ELO del puzzle disponible para esa posición se reduce** (el defensor, al intentar recuperarla, tendrá que colocar un puzzle de menor ELO del mismo tema).
- Visualmente la casilla queda marcada con el color/sello del atacante.
- No hay "victoria total" del raid — el resultado es la suma de casillas conquistadas individualmente.

### Límite de casillas por raid

Por definir el número exacto, pero la mecánica es:
- El atacante tiene un **máximo de casillas atacables por sesión** (ej. 8 de las 64).
- Esto crea tensión estratégica: elegir bien qué casillas atacar importa.
- El límite puede aumentar con progresión del usuario.

### Sistema de Strikes

- Acumulados durante un raid por: caer en trampa **Agujero Negro**, abandonar un puzzle, o agotar el tiempo del raid.
- **3 strikes = el raid termina** sin posibilidad de continuar las casillas restantes.

---

## Sistema de Poderes

Los poderes no están completamente definidos todavía, pero la estructura general es:

### Poderes del Defensor (trampas ocultas)

El defensor distribuye sus poderes en casillas elegidas antes de recibir ataques. El atacante no sabe qué casilla tiene un poder hasta que la selecciona.

| Poder | Mecánica | Visibilidad |
|---|---|---|
| **Agujero Negro** | Strike automático al seleccionar la casilla. No hay puzzle. | Oculto |
| **Trampa de Tiempo** | El cronómetro corre el doble de rápido durante ese puzzle. | Oculto |
| **Señuelo** | El ELO mostrado es falso — el puzzle real tiene ELO mayor. | Oculto |
| **Piedra** | La casilla está bloqueada. El atacante la ve pero no puede seleccionarla. | Visible (bloqueada) |
| **Escudo** | La casilla no puede ser atacada en este raid. | Visible (bloqueada) |

> Nota: Los poderes con visibilidad "Visible" son para niveles más avanzados y dan profundidad estratégica al tablero sin ser frustrantes para el atacante.

### Poderes del Atacante (ventajas activas)

El atacante los activa voluntariamente antes de resolver una casilla.

| Poder | Mecánica |
|---|---|
| **Descenso de ELO** | El puzzle presentado es del mismo tema pero con ELO 100 puntos menor. |
| **Congelar tiempo** | El cronómetro se pausa X segundos durante la resolución. |
| **Pista** | Muestra el primer movimiento del puzzle. |
| **Escáner** | Antes de seleccionar una casilla, revela si tiene una trampa (no el tipo). |

---

## Economía y Progresión

### Fuentes de poderes y recursos

- Resolver puzzles correctamente en rutinas de entrenamiento otorga recursos.
- Completar raids (independientemente del resultado) otorga recursos.
- Conquistar casillas otorga recompensas mayores.

### Progresión del usuario

- A mayor nivel, el defensor puede distribuir **más poderes** en su tablero.
- A mayor nivel, el atacante puede atacar **más casillas por raid**.
- El poder **Piedra** y **Escudo** se desbloquean en niveles más avanzados.

### Regeneración del tablero

- El defensor puede **recuperar casillas conquistadas** resolviendo nuevos puzzles del mismo tema en sus rutinas y reasignando esa casilla.
- El ELO del puzzle disponible para esa casilla habrá bajado como consecuencia de la conquista — recuperar el ELO original requiere seguir mejorando en ese tema.

### Período de escudo (por definir)

- Tras recibir un raid, el defensor recibe un **período de inmunidad temporal** antes de poder ser atacado de nuevo.

---

## Matchmaking y descubrimiento

- El atacante puede buscar tableros por **rango de ELO promedio** del tablero.
- Opcionalmente, el sistema puede sugerir tableros de usuarios de nivel similar.
- Los tableros con menos de 32 casillas no son visibles para los atacantes.

---

## Puntos pendientes de definir

- Número exacto de casillas atacables por raid.
- Duración del período de escudo tras recibir un raid.
- Coste en recursos de cada poder (defensor y atacante).
- Límite de poderes que el defensor puede distribuir por tablero.
- Sistema de ranking/ligas basado en conquistas acumuladas.
- Animaciones y feedback visual al revelar trampas o conquistar casillas.
