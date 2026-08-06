# Flujo de la invitación a calificar la app

La app pide la reseña **sola, una vez cada mucho, y solo cuando al usuario le
acaba de ir bien**. Para eso usa la tarjeta nativa de la Play Store (In-App
Review), que aparece encima de la pantalla de resultados sin sacar a nadie de
la app. Además, en Ajustes hay un acceso directo a la ficha de la tienda para
quien quiera calificar por iniciativa propia.

> Este documento describe cómo funciona lo implementado. La idea original
> (planificación) está en
> [`../features/CALIFICAR_APP.md`](../features/CALIFICAR_APP.md).

---

## Qué ve el usuario

**Nada, casi nunca.** Ese es el objetivo. Terminada una rutina, si se cumplen
todas las condiciones, unos 800 ms después de ver el resultado aparece la
tarjeta del sistema con las estrellas y el campo de comentario. Si no se
cumplen, no pasa absolutamente nada.

En **Ajustes** hay una sección nueva, *Apoya la app*, con una fila
**"Califícanos ⭐"** que abre la ficha de la Play Store. Esta vía no tiene cuota
ni espera: está siempre disponible.

## Cuándo se pide

Dos capas: primero *¿es este usuario candidato?* y luego *¿es este el instante?*

### Capa 1 — el gate (deben cumplirse todas)

| Condición | Valor |
|---|---|
| Rutinas terminadas | **≥ 3** |
| Días distintos con rutina terminada | **≥ 2** |
| Desde la última petición | **≥ 90 días** |

Las tres se evalúan sobre contadores propios (ver *Dónde vive el dato*). Los 90
días son **nuestros**, por encima de la cuota que el sistema aplica por su
cuenta: sirven para no gastar intentos a ciegas.

### Capa 2 — el instante

Con el gate cumplido, se mira cómo fue la rutina que se acaba de terminar:

| Situación | Resultado | `trigger` |
|---|---|---|
| Batió su récord de ELO | se pide | `new_record` |
| Falló más de la mitad, o perdió ELO | **nunca** se pide | — |
| Acertó ≥ 70 %, o ganó ELO | se pide | `good_routine` |
| Rutina tibia (ni buena ni mala) | se espera | — |
| Tercera rutina tibia seguida | se pide igual | `grace_window` |

La **ventana de gracia** existe porque hay quien entrena tranquilo y nunca
tiene un pico claro: si se esperara siempre a la victoria, a esa persona no se
le pediría la reseña jamás. Aun así, la regla de "nunca tras un mal rato" está
por encima de la ventana — pedir estrellas justo después de una rutina fallida
es la mejor forma de ganarse una.

Cuando se pide, se marca la fecha y **se reinicia la ventana de gracia**. Se
marca aunque el sistema decida no mostrar la tarjeta: no hay forma de saber si
la mostró, y reintentar en la siguiente rutina sería insistir a ciegas.

### Un solo aviso por visita

La pantalla de resultados ya tenía otro aviso en el mismo momento emocional: el
modal que propone activar el recordatorio de entrenamiento. Encadenar los dos
sería justo la clase de acoso que esta feature intenta evitar, así que se
resuelven en orden y **solo se muestra uno**:

```
runPostRoutinePrompts()
   │
   ├─ ¿toca proponer el recordatorio?  ─ sí ─▶ modal del recordatorio
   │                                            (la reseña solo suma al contador)
   └─ no ─▶ ¿toca pedir la reseña?     ─ sí ─▶ tarjeta nativa de la tienda
```

La rutina **siempre se cuenta**, se muestre lo que se muestre; lo único que
cambia es si además se puede pedir la reseña.

## Dónde vive el dato

Un único registro en `localStorage`, bajo la clave
`chessColate_app_review_state`. Nunca sale del dispositivo y no hay backend.

```ts
interface AppReviewState {
  completedRoutines: number;        // rutinas terminadas en total
  distinctDaysUsed: number;         // días distintos con al menos una
  lastRoutineDate: string | null;   // 'YYYY-MM-DD' de la última contada
  lastCountedPlanUid: string | null;// para no contar dos veces el mismo plan
  firstUseDate: string | null;
  lastReviewRequestDate: string | null;  // arranca la espera de 90 días
  eligibleSince: string | null;
  routinesSinceEligible: number;    // ventana de gracia
}
```

**No se guarda si el usuario calificó**: el API nativo no lo informa. Lo único
que se sabe es que *se pidió*.

`lastCountedPlanUid` cubre un detalle real de la pantalla: se puede volver a
ella (desde el historial, o porque el observable del plan vuelve a emitir) y sin
esa comprobación el contador se inflaría solo. Los planes abiertos desde el
historial, además, no cuentan en absoluto — no son una rutina recién terminada.

## Arquitectura

```
plan-played.component.ts     (sabe cómo fue la rutina)
      │
      ▼
AppReviewService             (decide y llama al plugin)   ← fachada
      │              │
      ▼              ▼
app-review.util   AppReviewStorageService
(lógica pura)     (localStorage)
      │
      ▼
@capacitor-community/in-app-review
```

Mismo principio de fachada que el `AnalyticsService`: **los componentes nunca
llaman al plugin**. La pantalla solo informa de `{ isNewRecord, accuracy,
eloDelta }` y el servicio decide.

Toda la lógica de decisión vive en [`app-review.util.ts`](../../apps/chessColate/src/app/services/app-review.util.ts),
sin Angular ni plugins, que es lo que la hace testeable: los 16 tests de
`app-review.util.spec.ts` cubren el gate, la espera de 90 días, la ventana de
gracia y la regla de la mala rutina sin necesidad de un dispositivo.

### Por qué la lógica es nuestra

El In-App Review API de Google es estricto y **no admite** pre-prompts
("¿te gusta la app? sí/no"), incentivos, ni condicionar funciones a calificar.
Tampoco informa del resultado ni garantiza que la tarjeta llegue a mostrarse.
Por eso a Google solo se le pide `requestReview()`; el "cuándo" es todo nuestro.

## Decisiones

| Decisión | Cómo quedó | Por qué |
|---|---|---|
| **Umbral de rutinas** | 3 | Con 1 no hay opinión formada; con 5 se llega tarde. |
| **Espera entre peticiones** | 90 días | Como mucho cuatro al año, por encima de la cuota del sistema. |
| **Ventana de gracia** | 2 rutinas tibias, se pide en la siguiente | Que el usuario tranquilo también entre, sin renunciar a buscar el pico. |
| **Puntos de disparo** | Solo el fin de rutina | Es donde ya se detecta el récord de ELO y donde vive el otro aviso, así que la exclusión mutua es trivial. Añadir Racha o Coordenadas multiplicaría los sitios a probar por poco a cambio. |
| **Toggle para apagarlo** | No | El flujo es silencioso y de baja frecuencia por diseño; ofrecer un interruptor invita a buscarlo. |
| **Reto 333** | Fuera | Termina en su propio modal y navega a home: no pasa por la pantalla de resultados. |
| **Web/PWA** | Solo se cuentan las rutinas | El plugin no hace nada en web y llamarlo gastaría la espera de 90 días para nada. La fila de Ajustes sí funciona: abre la ficha web. |

## Bordes conocidos

- **En desarrollo la tarjeta no aparece.** El In-App Review solo funciona con la
  app instalada desde Play Store o desde un canal de pruebas. En `debug` la
  llamada no falla, simplemente no muestra nada — es lo esperado.
- **Cuota del sistema**: aunque se cumplan todas las condiciones, Google puede
  decidir no mostrarla. No hay forma de saberlo ni de forzarlo.
- **iOS queda pendiente**: el plugin lo soporta (`SKStoreReviewController`) y la
  lógica es la misma, pero no se ha validado en dispositivo ni se ha revisado el
  copy de la tienda. La fila de Ajustes apunta hoy a la Play Store.
- **Si se borran los datos de la app** se pierden los contadores y el usuario
  vuelve a empezar el gate desde cero. Aceptable: no hay nada que valga la pena
  sincronizar a Firestore por esto.

## Analítica

Dos eventos, catalogados en
[OBSERVABILITY_REFERENCIA](./OBSERVABILITY_REFERENCIA.md#6-catálogo-de-eventos-as-built):

| Evento | Params |
|---|---|
| `app_review_requested` | `trigger`, `completed_routines` |
| `app_review_store_opened` | — |

No se puede medir si alguien calificó; se miden **peticiones** y **aperturas
manuales**. El impacto real se ve en el volumen y el rating de Play Console, y
la distribución de `trigger` dice si la ventana de gracia está haciendo falta o
si casi todo entra por `new_record`.

## Archivos

| Archivo | Rol |
|---|---|
| [`services/app-review.util.ts`](../../apps/chessColate/src/app/services/app-review.util.ts) | lógica pura: contadores, gate, disparador |
| [`services/app-review.util.spec.ts`](../../apps/chessColate/src/app/services/app-review.util.spec.ts) | tests de la lógica |
| [`services/app-review-storage.service.ts`](../../apps/chessColate/src/app/services/app-review-storage.service.ts) | `localStorage` |
| [`services/app-review.service.ts`](../../apps/chessColate/src/app/services/app-review.service.ts) | fachada: plugin, ficha de la tienda, analítica |
| [`plan-played.component.ts`](../../apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts) | enganche y exclusión con el aviso del recordatorio |
| [`settings.page.html`](../../apps/chessColate/src/app/pages/settings/settings.page.html) | sección *Apoya la app* |
| `assets/i18n/{es,en}.json` | claves `SETTINGS.support` y `APP_REVIEW.*` |
| `apps/chessColate/android/` | registro del plugin (`npx cap sync android`) |

## Fuera de alcance

iOS, hitos de racha como disparador, y cualquier A/B testing del momento o de
los umbrales. Los tres se deciden mejor **con los datos** que empiece a dar
`app_review_requested`.
