# Notificaciones de Entrenamiento — Feature Document

## Concepto

Recordatorios locales (sin servidor) que invitan al usuario a volver a entrenar. La clave no es "mandar una notificación al día porque sí", sino **aprender a qué hora suele entrenar cada usuario y avisarle justo en ese momento**.

Si una persona normalmente resuelve puzzles a las 9:00 pm después de cenar, la app debe recordárselo alrededor de esa hora — no a las 3:00 pm cuando está trabajando. El objetivo es que la notificación se sienta como un empujón oportuno y no como spam, para consolidar el **hábito diario** de entrenar.

Todo el cómputo ocurre **en el dispositivo**. No dependemos de push remoto ni de backend: usamos notificaciones locales programadas por Capacitor. Esto las hace privadas, gratis y funcionales sin conexión.

---

## Objetivos

- Aumentar la **retención D1/D7** y las rachas (streaks) de entrenamiento.
- Formar el hábito de entrenar todos los días a una hora consistente.
- Que el recordatorio caiga en la **franja horaria habitual** del usuario, no en una hora fija arbitraria.
- Cero fricción: se activa de forma opcional y el usuario controla horario y frecuencia.

---

## Flujo de usuario

```
[Usuario entrena varias sesiones]
         ↓
[La app registra la hora local de cada sesión]
         ↓
[Se calcula la "franja habitual de entrenamiento"]
         ↓
[Se pide permiso de notificaciones (momento oportuno, no al primer arranque)]
         ↓
[Se programa el recordatorio diario en esa franja]
         ↓
┌─────────────────────────────────────────────┐
│  Llega la hora habitual y hoy NO ha entrenado │
├─────────────────────────────────────────────┤
│  🔔 "¿Listo para tu entrenamiento de hoy?"    │
│      → toca la notificación                    │
│      → abre directo al modo de entreno         │
└─────────────────────────────────────────────┘
         ↓
[Si ya entrenó hoy antes de la hora → NO se notifica]
```

---

## Detección de la "hora habitual"

El corazón del feature. En vez de pedir al usuario que elija una hora, la **inferimos** de su comportamiento y la ofrecemos como sugerencia (editable).

### Señal que registramos

Cada vez que el usuario completa una sesión de entrenamiento guardamos, en local, la **hora local** de inicio (o fin) de esa sesión:

```
trainingEvents: Array<{ timestamp: number; hourLocal: number; minuteLocal: number }>
```

Solo interesa la hora del día, no la fecha exacta (aunque conservamos el timestamp para poder descartar datos viejos).

### Cálculo de la franja

1. Tomamos las últimas **N sesiones** (p. ej. 30) o las de los últimos **14 días**.
2. Agrupamos por franjas de la mañana/tarde/noche o por *bins* de hora (p. ej. cada 30 min).
3. Elegimos el **bin con más sesiones** (moda). Ante empate, preferimos la franja más reciente.
4. Con ≥ 5 sesiones tenemos confianza suficiente; con menos usamos un **default sensato** (p. ej. 8:00 pm) hasta acumular datos.
5. Programamos el recordatorio **al inicio de ese bin** (o unos minutos antes, para "atraparlo" antes de la hora pico).

> Nota: se trabaja siempre en **hora local del dispositivo**. Si el usuario viaja/cambia de zona, la próxima reprogramación se ajusta sola.

### Reajuste continuo

La franja se recalcula periódicamente (al abrir la app / al completar una sesión). Si el patrón del usuario cambia (empieza a entrenar en las mañanas), el recordatorio migra con él. Esto lo diferencia de una simple "alarma diaria" configurada a mano.

---

## Regla de "no molestar si ya entrenó"

La notificación **solo tiene sentido si el usuario aún no entrenó hoy**. Como las notificaciones locales se programan por adelantado, aplicamos esta lógica:

- Al abrir la app y al completar una sesión, **reprogramamos** el próximo recordatorio.
- Si el usuario **ya entrenó hoy**, cancelamos el recordatorio de hoy y programamos el de mañana.
- Si no ha entrenado, dejamos el de hoy activo en su franja habitual.

Alternativa/refuerzo: cancelar la notificación pendiente en cuanto arranca una sesión de entrenamiento.

---

## Copys sugeridos (borrador)

> El copy final debe alinearse antes de implementar (ver [STYLE_GUIDE](../STYLE_GUIDE.md) y el tono de ChessColate).

- "¿Listo para tu jugada del día? ♟️"
- "Tu racha te espera 🔥 — 3 puzzles rápidos y listo."
- "Es tu hora de entrenar. Vamos por un mate. ♟️"
- Con racha activa: "No pierdas tu racha de {N} días 🔥"

Se puede rotar el copy para que no se sienta repetitivo, y variarlo según haya o no racha activa.

---

## Modelo de datos (local)

```ts
interface TrainingReminderState {
  enabled: boolean;              // el usuario activó el recordatorio
  permissionGranted: boolean;    // permiso del SO concedido
  suggestedHour: number;         // hora inferida (0–23)
  suggestedMinute: number;       // minuto inferido
  overriddenByUser: boolean;     // el usuario fijó su propia hora
  lastTrainedDate: string;       // 'YYYY-MM-DD' local, para la regla "ya entrenó hoy"
  scheduledNotificationId: number | null;
}

interface TrainingEvent {
  timestamp: number;
  hourLocal: number;
  minuteLocal: number;
}
```

Persistencia local (ej. `@capacitor/preferences` o el storage ya usado en la app). No requiere backend.

---

## Stack técnico

- **Plugin**: [`@capacitor/local-notifications`](https://capacitorjs.com/docs/apis/local-notifications) — programación de notificaciones locales en iOS y Android, con soporte de `schedule` recurrente (`every: 'day'` a hora fija) o por `at` con fecha concreta.
- **Permisos**: `LocalNotifications.requestPermissions()`. Pedirlo en un **momento oportuno** (p. ej. tras la primera racha o al terminar una sesión con buen resultado), no en el primer arranque en frío.
- **Navegación al tocar**: escuchar `localNotificationActionPerformed` para hacer *deep-link* directo al modo de entrenamiento.
- **Reprogramación**: al `resume`/apertura de la app y al finalizar sesión, recalcular franja + regla "ya entrenó hoy" y volver a agendar.
- **Web/PWA**: `@capacitor/local-notifications` no cubre bien web; en navegador se puede degradar a la Notifications API + Service Worker, o simplemente desactivar el feature. (Definir en fase de alcance.)

### Estrategia de agendado

Para respetar la regla "no molestar si ya entrenó", conviene **agendar de forma incremental** (una sola notificación con `at` para el próximo recordatorio) y reprogramar en cada apertura/sesión, en vez de una recurrencia `every: 'day'` ciega. Así podemos saltar el día si ya entrenó.

Opcionalmente, agendar 1–2 días por adelantado como *fallback* por si el usuario no abre la app.

---

## Configuración del usuario

En Ajustes:

- **Toggle** "Recordatorio de entrenamiento".
- **Hora sugerida** mostrada como "Te recordaremos a eso de las {hora} (tu hora habitual)", con opción de **editar** (`overriddenByUser`).
- Frecuencia: diaria por defecto; opción de días específicos (p. ej. solo entre semana) — *nice to have*.

---

## Consideraciones UX

- **Pedir permiso con contexto**: explicar el valor ("te avisamos a tu hora para que no pierdas la racha") antes del prompt nativo.
- **No ser molesto**: máximo un recordatorio al día; nada de re-notificar si lo ignora.
- **Respetar horarios de descanso**: no programar de madrugada aunque los datos digan eso; acotar a una ventana razonable (p. ej. 7:00–22:30) salvo override.
- **Racha como gancho**: cuando hay streak activo, el copy debe apelar a no perderlo.
- **Silencioso al día ya cumplido**: si entrenó, el recordatorio no aparece — refuerza que la app "sabe" lo que hace.

---

## Métricas de éxito

- % de usuarios que activan el recordatorio.
- CTR de la notificación (aperturas / notificaciones mostradas).
- Retención D1/D7 y longitud media de rachas con vs. sin recordatorio.
- % de sesiones iniciadas dentro de la ventana ±30 min de la hora sugerida.

---

## Alcance inicial (MVP)

1. Registrar la hora local de cada sesión de entrenamiento.
2. Calcular franja habitual (moda por bins) con default si hay pocos datos.
3. Toggle + permiso + agendado de un recordatorio diario en la franja.
4. Regla "no notificar si ya entrenó hoy" vía reprogramación.
5. Deep-link al modo de entrenamiento al tocar la notificación.

## Fuera de alcance inicial

- Notificaciones push remotas / segmentación desde backend.
- Múltiples recordatorios al día.
- Aprendizaje avanzado del patrón (varias franjas, fines de semana distintos).
- Soporte pleno en web/PWA.

---

## Dependencias técnicas

- `@capacitor/local-notifications` (agregar al proyecto).
- Storage local ya existente para persistir `TrainingReminderState` y `TrainingEvent[]`.
- Hook en el flujo de fin de sesión de entrenamiento para registrar el evento y reprogramar.
