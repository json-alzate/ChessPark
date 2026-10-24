# SEO con Prerender de las Páginas Públicas — Feature Document

## Concepto

Hoy ChessColate en la web es una **SPA pura**: Firebase Hosting reescribe cualquier ruta a `index.html` y el navegador arma la pantalla con JavaScript. Para un bot de buscador (o para quien comparte un enlace en redes) **todas las rutas son la misma página vacía**: mismo `<title>`, misma descripción, un `<app-root>` sin contenido.

Esta feature hace que las **páginas públicas** (las que sí pueden posicionar) salgan **con su HTML ya escrito** y con sus propios metadatos, para que Google las indexe y las vistas previas al compartir muestren algo útil.

> **Idea central:** **prerenderizar (SSG) en el build**, no hacer SSR en caliente. El resultado sigue siendo una carpeta de archivos estáticos que Firebase Hosting sirve tal cual: **sin Cloud Functions, sin Cloud Run, sin plan Blaze**, y el build nativo (Android/iOS) no cambia.

---

## Por qué prerender y no SSR completo

SSR "de verdad" en Firebase exige un servidor (Cloud Functions / Cloud Run / App Hosting) y, con él, el plan Blaze. Pero el costo no es solo de infraestructura:

| Frente | Con SSR completo | Con prerender |
|---|---|---|
| **Backend** | Servidor Node propio, plan Blaze, cold starts | Ninguno: archivos estáticos en Hosting |
| **Arranque de la app** | Todo `provideAppInitializer` corre en servidor | Corre solo durante el build, una vez por ruta |
| **Capacitor** | Hay que mantener dos salidas (server + browser) | El bundle de navegador no cambia |
| **Datos por usuario** | Riesgo de renderizar estado de una sesión en otra | No hay sesión: se renderiza la vista anónima |
| **Ionic** | Hidratación con fricción en cada componente | Misma fricción, pero acotada a pocas rutas |

Además, **casi toda la app no es contenido indexable**: entrenar, racha, tablero, análisis y ajustes son herramientas interactivas sin valor de búsqueda. Lo que sí puede posicionar es un puñado de rutas.

**SSR real solo valdría la pena** si algún día hay contenido dinámico, infinito y público (p. ej. una página indexable por cada partida o por cada puzzle). Mientras la lista sea finita (el catálogo `games/:id`), el prerender también la cubre.

---

## Qué rutas se prerenderizan

| Ruta | Prerender | Motivo |
|---|:---:|---|
| `/home` (y `/`) | ✅ | Puerta de entrada: qué es la app, para quién |
| `/games` | ✅ | Catálogo de partidas de campeones: contenido real e indexable |
| `/games/:id` | 🟡 | Solo si el catálogo es finito y se puede listar en el build (ver decisiones abiertas) |
| `/donation` | ✅ | Pública y sin sesión |
| `/privacy` | ✅ | Pública; Google Play y las tiendas la piden como URL |
| Entrenar, racha, coordenadas, knight-tour, chess960, analytics, ajustes, recordatorios, planes | ❌ | Interactivas, dependen del dispositivo o de la sesión; `noindex` |

Las rutas privadas o de herramienta **no se prerenderizan** y deben llevar `noindex` (ver Metadatos) para que el buscador no gaste presupuesto de rastreo en pantallas vacías.

---

## Qué hay que cambiar

### 1. Build con prerender

En [`apps/chessColate/project.json`](../../apps/chessColate/project.json), el builder `@angular/build:application` admite `prerender` (con la lista de rutas) además del `browser` actual. Hace falta `@angular/ssr` como dependencia del build, aunque **no se despliega ningún servidor**.

Punto delicado: el prerender **ejecuta la app en Node** una vez por ruta, así que el arranque de [`main.ts`](../../apps/chessColate/src/main.ts) debe tolerarlo. Hoy `initializeApp` hace `await` de cosas que solo existen en navegador:

- `LanguageService.initializeLanguage()` (traducciones).
- `AppService.loadThemesPuzzle()` y `loadOpenings()`.
- `PuzzlesProvider.init()` (caché en **IndexedDB**).
- `AppearanceService.init()` (toca el DOM/`localStorage`).

Salida limpia: en servidor, saltarse lo que no aporta al HTML (`PuzzlesProvider.init()`, `AppearanceService`) con `isPlatformBrowser`/`PLATFORM_ID`, y dejar el idioma resuelto con el valor por defecto.

### 2. Código que asume navegador

Cualquier servicio o componente de las rutas prerenderizadas que toque `window`, `document`, `localStorage`, `indexedDB` o `cm-chessboard` rompe el build. Las libs (`@chesspark/board`, `puzzles-provider`, `common-utils`, `state`) se tocan solo si esas rutas las importan. Conviene **empezar por `/privacy` y `/donation`** (las más simples) para destapar los problemas del arranque antes de llegar a `/home` y `/games`.

### 3. Metadatos por ruta

Hoy [`index.html`](../../apps/chessColate/src/index.html) tiene un solo juego de etiquetas para todo, con inconsistencias:

- `<html lang="en">` pero la descripción está en español.
- `og:url` apunta a `https://chesscolate.web.app`, fijo, sin importar la ruta.
- No hay `canonical`.

Cada ruta pública debería fijar con `Title` y `Meta` de Angular: `title`, `description`, `og:title`, `og:description`, `og:url`, `canonical`. Lo ideal es que salga de **`data` en la definición de la ruta** ([`app.routes.ts`](../../apps/chessColate/src/app/app.routes.ts)) y un único servicio lo aplique al navegar, en vez de repetirlo en cada página. Las rutas privadas añaden `<meta name="robots" content="noindex">`.

### 4. `robots.txt` y `sitemap.xml`

Van en `apps/chessColate/src/assets` (o en la raíz del `public`) para que queden en la raíz del hosting:

- `robots.txt`: permitir todo lo público, apuntar al sitemap.
- `sitemap.xml`: solo las rutas prerenderizadas. Si `games/:id` entra, se genera en el build desde el índice del catálogo.

### 5. Firebase Hosting y el service worker

- [`firebase.json`](../../firebase.json) hoy reescribe `**` → `/index.html`. Con prerender, Hosting sirve primero el archivo existente (`/privacy/index.html`) y la reescritura queda como respaldo para las rutas de la app. Hay que **verificar que el orden no pise los HTML prerenderizados** y que `index.html` mantenga `Cache-Control: no-cache` también en las rutas nuevas.
- El service worker (`ngsw-config.json`) puede seguir sirviendo `index.html` como respaldo de navegación para las rutas de la app. Hay que comprobar que no interfiera con los HTML prerenderizados en la primera visita.

### 6. Contenido legible por bots

El prerender solo ayuda si el HTML trae **texto y encabezados reales** (`<h1>`, párrafos, enlaces). Si `/home` se pinta con componentes de Ionic que cargan sus datos después, el HTML prerenderizado seguiría casi vacío. Hay que revisar qué trae `/home` en el primer pintado y, si hace falta, añadir un bloque de texto descriptivo visible.

---

## Idioma: la decisión de fondo

La app es bilingüe (`en` / `es`, con `defaultLang: 'en'` en Transloco) pero **el idioma no vive en la URL**: es una preferencia del dispositivo. Para un buscador eso significa **una sola versión por ruta**, la del idioma por defecto.

Para posicionar en ambos idiomas hay dos caminos:

| Opción | Qué implica | Esfuerzo |
|---|---|---|
| **A. Un solo idioma indexable** (el de `index.html`) | Se prerenderiza solo esa versión; el resto lo ve la app una vez cargada | Bajo |
| **B. Rutas por idioma** (`/es/...`, `/en/...`) con `hreflang` | Cada ruta pública se prerenderiza dos veces; el idioma sale de la URL; `<html lang>` y `og:locale` por versión | Medio-Alto |

La opción A es el punto de partida razonable. B es una feature aparte por el cambio de enrutado que supone.

---

## Fases

| Fase | Contenido | Resultado verificable |
|:---:|---|---|
| **0** | Metadatos correctos en `index.html` (`lang`, `og:url`, `canonical`), `robots.txt` y `sitemap.xml` con las rutas públicas | Search Console acepta el sitemap; las vistas previas al compartir salen bien (**sin tocar el build**) |
| **1** | Servicio de metadatos por ruta (`Title`/`Meta` desde `data` de la ruta) + `noindex` en rutas privadas | Cada ruta pública tiene su `<title>` y descripción al ejecutarse en el navegador |
| **2** | `@angular/ssr` + `prerender` de `/privacy` y `/donation`; arranque tolerante a servidor | `curl` a esas rutas devuelve HTML con contenido, sin ejecutar JS |
| **3** | Prerender de `/home` y `/games`; ajustar `firebase.json` y revisar el service worker | Misma comprobación; la app sigue arrancando normal tras hidratar |
| **4** *(opcional)* | `games/:id` desde el índice del catálogo; rutas por idioma con `hreflang` | Sitemap con las partidas; versiones `es`/`en` enlazadas entre sí |

La **Fase 0 sola** ya corrige lo más barato (metadatos incoherentes y falta de sitemap) y **no arriesga nada**: es la primera a atacar.

---

## Riesgos y bordes

- **El build puede romper por una dependencia que toca `window` al importarse** (por ejemplo `cm-chessboard` o `swiper/element/bundle`, que `main.ts` registra al inicio). Si pasa, se aísla con importación dinámica solo en navegador.
- **Hidratación de Ionic**: si el HTML prerenderizado y el cliente difieren, Angular lo avisa en consola y puede repintar. Se valida en el navegador, no solo con `curl`.
- **Service worker sirviendo HTML viejo**: un HTML prerenderizado cacheado puede quedar desactualizado tras un despliegue. Mantener `no-cache` en los `index.html` de las rutas y comprobar el flujo de actualización de la PWA.
- **Tamaño del build y del despliegue**: unas pocas rutas no lo cambian de forma apreciable; `games/:id` sí lo haría si el catálogo crece.
- **El SEO no es solo técnico**: sin contenido útil y enlaces entrantes, prerenderizar no posiciona por sí solo.

---

## Decisiones abiertas

1. **¿Un idioma o dos?** (opción A o B de arriba). Define si hay rutas por idioma.
2. **¿Entra `games/:id`?** Depende de si interesa que cada partida del catálogo sea una página indexable.
3. **¿Dominio canónico?** Hoy `chesscolate.web.app`; si existe un dominio propio, `canonical`, `og:url` y sitemap deben usarlo desde el principio.
4. **¿Qué texto lleva `/home`** para el buscador? Hoy es sobre todo interfaz; hace falta un copy corto que explique qué es la app (respetando la [guía de tono](../GUIA_DE_TONO.md)).

---

## Fuera de alcance

- **SSR en caliente** (Cloud Functions / Cloud Run / App Hosting). Se reconsidera solo si aparece contenido dinámico público a escala.
- **Posicionamiento de las tiendas (ASO)**: Play Store / App Store tienen su propio SEO, aparte de esto.
- **Rutas por idioma**, salvo que se decida la opción B (sería su propia feature).
