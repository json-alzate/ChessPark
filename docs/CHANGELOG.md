# Changelog — chessColate

Registro de versiones publicadas de **chessColate** (`com.jheison.chesscolate`).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado sigue [SemVer](https://semver.org/lang/es/) para `versionName`.

> **Convención de release (Play Store)**
> - `versionName` → versión visible (SemVer: `MAJOR.MINOR.PATCH`).
> - `versionCode` → entero incremental; **debe subir en cada subida** a Play Store.
> - Ambos se editan en
>   [`apps/chessColate/android/app/build.gradle`](../apps/chessColate/android/app/build.gradle).
> - Antes de compilar: `npm run android:sync` (build web + `cap sync android`),
>   luego abrir Android Studio y generar el AAB/APK firmado.

---

## [2.0.5] — 2026-07-14 · `versionCode 22`

### Añadido
- **Observabilidad (Firebase Analytics + Crashlytics)**: la app registra ahora los
  errores/crashes de producción y las métricas de uso, todo detrás de una fachada
  única (`AnalyticsService`) y un `ErrorHandler` global. Disponible en **Android y Web**
  (iOS pendiente).
- **Seguimiento de pantallas** (`screen_view`) con nombres legibles, y asociación de
  eventos y errores al usuario (UID de Firebase) tras iniciar sesión.
- **Eventos de negocio**: inicio de rutinas (por defecto, infinity, Reto 333,
  personalizadas y públicas), puzzles iniciados y resueltos/fallados, fin del Reto 333,
  coordenadas, recorrido del caballo, visor de Ajedrez 960, creación/edición de rutinas,
  guardado de rutinas públicas, cambio de idioma y donaciones completadas.

### Notas
- Analytics y Crashlytics se activan **solo en producción** (flags por entorno).
- Pendiente tras este release: activar **iOS** y registrar las **dimensiones
  personalizadas** en GA4 — ver [PENDIENTES.md](PENDIENTES.md).

---

## [2.0.4] — 2026-07-06 · `versionCode 21`

### Añadido
- **Onboarding narrativo y jugable**: primer contacto guiado con un mate en 1 jugable
  y un mate en 2 guiado, para que la persona logre un primer éxito real desde el inicio.
- **Récord de racha** en la tarjeta del Reto 333.
- Detalle de bloques **clickeable** y **slider de rutina recomendada** en el menú de entrenamiento.

### Cambiado
- **Rediseño del menú de entrenamiento** con tarjetas de bloques; se recomienda la rutina de 10'.
- **Rediseño de las tarjetas del home**: entrenamiento continuo (hero vertical),
  Reto 333 y donación (card compacta horizontal).
- Menú de rutinas **minimalista** en la vista de plan terminado, con animalitos como identificador.
- **Reto 333 internacionalizado** (todos los textos).
- Mejoras de UX en selección de idioma, menú de entrenamiento y onboarding.
- Skeletons del menú ajustados a las tarjetas reales.

> _En preparación (aún no incluido en esta versión):_ notificaciones locales para recordar
> entrenar a la hora habitual — ver [NOTIFICACIONES_ENTRENAMIENTO.md](features/NOTIFICACIONES_ENTRENAMIENTO.md).

---

## [2.0.3] — 2026-06-16 · `versionCode 20`

### Añadido
- **Plataforma iOS** con Firebase Auth + Google Sign-In.
- **Página de ajustes** y terminología de entrenamiento unificada.
- Menú lateral reorganizado por grupos lógicos.
- Persistencia del **idioma del invitado** (localStorage).
- SplashScreen API de Android 12 con icono animado.
- Extensión de Chrome (**chess-extension**): entrenamiento por bloques de tiempo,
  ELO por puzzle, modo popup y mejoras de UI.

### Cambiado
- Donación simplificada.
- Home fluido en 1024px con escalado lg/xl.
- RevenueCat se inicializa en segundo plano para no bloquear el splash.
- Fechas relativas del historial de rutinas traducidas; Reto 333 excluido del historial.
- Mejor UX en la creación de bloques de rutinas personalizadas.

### Corregido
- Sincronización de puzzles: se evitan callbacks async obsoletos que desincronizaban el estado.
- Filtro de peticiones contra un manifiesto de combinaciones válidas.
- Estado de récord empatado en los resultados de coordenadas.
- Claves i18n faltantes y ruta de traducción rota.
- Skeletons del home mobile ajustados al tamaño del contenido.
- Safe areas en modales y navbar/menús laterales de iOS.

---

## [2.0.0 – 2.0.2] — 2026-05 (históricos)

- Base 2.0 de chessColate tras la migración del proyecto.
- Correcciones de safe area en iOS (navbar, menús laterales y modales).

> Nota: los `versionCode` de estas versiones no quedaron registrados de forma
> consistente en `build.gradle` (saltó de `2.0.0`/`code 18` a `2.0.3`/`code 20`).
> A partir de la 2.0.3 el `versionCode` se lleva de forma incremental y trazable.
