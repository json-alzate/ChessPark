# Guía de tono y voz - ChessColate

> **Estado: borrador.** Las decisiones de vocabulario ya están aplicadas en `es.json` y `en.json`; el resto de la guía sigue en revisión.

Esta guía define cómo habla ChessColate: en los textos de la interfaz, los mensajes de error, las notificaciones y las descripciones. Complementa a la [Guía de Estilos UI/UX](STYLE_GUIDE.md), que cubre la parte visual.

---

## 1. Personalidad

ChessColate es un compañero de entrenamiento: cercano, claro y con un toque de humor ligero. No es un profesor que corrige ni un juego que presiona.

| Sí | No |
|----|----|
| Directo y concreto | Rodeos o frases vacías |
| Cercano, como un amigo que juega ajedrez | Infantil o efusivo |
| Motivador sin presionar | Culpógeno ("Llevas 3 días sin entrenar") |
| Serio con la técnica, relajado con el juego | Solemne con cosas que son un juego |

**Principio general:** el usuario viene a jugar y a disfrutar. Cada texto debe sentirse como un paso hacia el siguiente movimiento, no como una tarea pendiente.

---

## 2. Tratamiento

- **Usamos "tú"** en todo: "Empieza tu racha", "Elige un modo".
- No usamos "usted" ni voseo.
- Los textos de la interfaz van en **infinitivo o imperativo** para acciones: "Iniciar sesión", "Guardar", "Elige un modo".

---

## 3. Vocabulario

Estos términos deben usarse siempre igual, en la interfaz y en la documentación.

| Término | Uso | Evitar |
|---------|-----|--------|
| **Partida** | Una partida de ajedrez jugada o importada | Juego, match |
| **Ejercicio** | Una posición táctica a resolver | Puzzle (en textos para el usuario) |
| **Sesión** | Un bloque de entrenamiento (antes "rutina"). Para empezarla usar "Empezar sesión", no "Iniciar sesión", que es el login | Rutina, tarea, plan (en textos para el usuario) |
| **Racha** | Serie de ejercicios seguidos sin fallar | Streak (en textos) |
| **ELO** | Puntuación de rating; siempre en mayúsculas | Elo, rating |
| **Coordenadas, Recorrido del caballo, Chess960** | Nombres de los modos | Variantes genéricas |

---

## 4. Formato y puntuación

- **Signos de apertura obligatorios:** ¡Ups! · ¿Seguro que quieres salir?
- **Puntos suspensivos:** usar el carácter `…`, nunca tres puntos (`...`).
- **Guiones largos (—):** evitarlos; usar punto o dos puntos.
- **Mayúsculas:** tipo oración ("Recorrido del caballo", no "Recorrido del Caballo"). Los títulos de pantalla también en tipo oración.
- **Exclamaciones:** máximo una por pantalla. Reservarlas para celebrar un logro, no para avisos.
- **Números:** cifras para tiempos, ELO y puntajes ("3 min", "1748"). Textos cortos sin unidades cuando el contexto ya las da.

---

## 5. Patrones por tipo de mensaje

### Títulos y botones
- Cortos: 1 a 3 palabras. "Iniciar sesión", "Ver partidas", "Donar".
- Un solo verbo por botón. Evitar "Sí, quiero salir de la app".

### Estados vacíos
- Explicar qué falta y, si es posible, qué hacer.
- ✅ "Aún no hay partidas suficientes para dibujar la evolución."
- ❌ "No hay datos."

### Errores
- Decir qué pasó y qué puede hacer el usuario. Sin culpar al usuario ni usar lenguaje técnico.
- ✅ "Las contraseñas no coinciden."
- ✅ "Las notificaciones están desactivadas en el sistema. Actívalas en los ajustes de tu dispositivo."
- ❌ "Error 500" · "Operación fallida"

### Feedback en la partida
- Breve y sin juicio fuerte. Un error se nombra como un hecho, no como un castigo.
- ✅ "Ese no es el mejor movimiento."
- ❌ "¡Fallaste!" (tono de castigo)

### Racha y progreso
- Celebrar sin presionar. Nunca frases que generen culpa por perder la racha.
- ✅ "Llevas 12 ejercicios seguidos."
- ❌ "¡No pierdas tu racha!" (presión)

### Confirmaciones de acciones destructivas
- Decir qué se pierde y qué no. Mismo tono que el resto.
- ✅ "Borrarlos no afecta a tu progreso ni a tu ELO."

### Notificaciones y recordatorios
- Breves, sin urgencia, y solo cuando aportan. Explicar por qué llega el aviso.
- ✅ "Sueles entrenar a eso de las 18:00. Te avisamos a esa hora."

---

## 6. Qué evitar

- **Emojis** en textos de la interfaz (los íconos visuales van en la guía de estilos).
- **Jerga de desarrollo** o de la base de datos.
- **Superlativos y promesas** ("el mejor", "increíble").
- **Presión de tiempo o de racha** ("¡Última oportunidad!", "No te quedes atrás").
- **Humor forzado.** El tono ligero aparece en frases simples, no en chistes.

---

## 7. Checklist para textos nuevos

- [ ] ¿Usa "tú" y tiene signos de apertura (¿ ¡)?
- [ ] ¿Usa los términos de la sección 3?
- [ ] ¿Está en tipo oración y con `…` en vez de `...`?
- [ ] ¿Dice qué pasó o qué hacer, sin culpar ni presionar?
- [ ] ¿Cabe en el espacio del componente sin cortarse?

---

## Referencias

- [Guía de Estilos UI/UX](STYLE_GUIDE.md) — parte visual
- [docs/decisions/0001-orden-menu-lateral.md](decisions/0001-orden-menu-lateral.md) — orden del menú lateral
