# Puzzle Geo Hunt — Feature Document

## Concepto

Modo de juego inspirado en Pokémon GO. Un puzzle de ajedrez se "despliega" en el mundo real: las piezas relevantes del puzzle aparecen dispersas en un radio alrededor del usuario. El jugador debe caminar hasta cada ubicación para capturarlas, ya sea viendo los marcadores en el mapa o usando la cámara del teléfono en modo AR (como Pokémon GO). Con las piezas capturadas, puede resolver el puzzle.

### Experiencia del usuario

1. El usuario elige un puzzle (por ELO, tema o número de piezas a capturar).
2. Las piezas relevantes del puzzle se dispersan en un radio alrededor de su posición actual.
3. Se traza una **ruta completa** en el mapa: usuario → pieza A → pieza B → pieza C → ...
4. El usuario sigue la ruta. Al llegar a cada punto puede capturar la pieza:
   - **Vista mapa**: marcador en el mapa, se captura al estar a <20m.
   - **Vista AR**: la pieza aparece en el mundo real a través de la cámara del teléfono.
5. Con las piezas capturadas, se habilita el tablero para resolver el puzzle.

---

## Qué piezas se capturan

No todas las piezas de la posición participan — solo las **piezas relevantes del puzzle**:
- Las piezas que se mueven en la solución.
- Los reyes (siempre relevantes en tácticas de mate).
- Piezas defensoras clave de la posición objetivo.

Esto lo determina el metadata del puzzle (ya existente en la colección de puzzles).

### Niveles por número de piezas

| Nivel | Piezas a capturar | Recorrido estimado |
|---|---|---|
| Fácil | 1 pieza | ~5 min |
| Normal | 2 piezas | ~10 min |
| Difícil | 3 piezas | ~15 min |
| Experto | 4+ piezas | ~20+ min |

El nivel también se puede cruzar con ELO del puzzle y tema (clavada, horquilla, mate en 2, etc.).

---

## Todo es local — sin Firestore

El estado de la sesión Geo Hunt vive completamente en el cliente:

```typescript
interface GeoHuntSession {
  puzzle: Puzzle;                  // puzzle seleccionado (ya en memoria)
  pieces: GeoHuntPiece[];          // piezas a capturar con sus coords
  status: 'active' | 'completed';
  startedAt: Date;
}

interface GeoHuntPiece {
  notation: string;    // e.g. 'Qd5', 'Ke1'
  lat: number;         // coord snapeada a calle
  lng: number;
  captured: boolean;
}
```

No hay necesidad de persistir en servidor porque:
- El puzzle ya existe en la base de datos.
- Una sesión abandonada simplemente se descarta.
- Si se necesitara historial en el futuro, se registra solo el `puzzleId` + resultado al completar.

---

## Stack técnico (sin costo)

### Mapa y routing
| Necesidad | Herramienta | Costo |
|---|---|---|
| Mapa interactivo | [Leaflet.js](https://leafletjs.com/) | Gratis |
| Tiles visuales | [Stadia Maps](https://stadiamaps.com/) | 200k tiles/mes gratis |
| Snap a calle | [OSRM](http://project-osrm.org/) `/nearest` | Gratis |
| Ruta completa | OSRM `/route` (múltiples waypoints) | Gratis |
| Dibujar ruta | [Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/) | Gratis |
| GPS usuario | `navigator.geolocation` | Gratis (nativo) |
| Proximidad | Haversine client-side | Gratis (sin API) |

### AR (vista cámara)
| Necesidad | Herramienta | Costo |
|---|---|---|
| AR location-based | [AR.js](https://ar-js-org.github.io/AR.js-Docs/) (location component) | Gratis |
| 3D rendering | [A-Frame](https://aframe.io/) | Gratis |
| Cámara + GPS + brújula | APIs nativas del browser | Gratis |

> AR.js con componente `gps-new-entity-place` posiciona objetos 3D en coordenadas GPS reales. Al apuntar la cámara hacia donde está la pieza, aparece en pantalla como en Pokémon GO. Funciona en Chrome Android y Safari iOS (con permisos de cámara/giroscopio).

---

## Ruta optimizada entre piezas

En lugar de ir a las piezas en orden arbitrario, se calcula la **ruta completa óptima**:

```
usuario → pieza más cercana → siguiente más cercana → ... → última pieza
```

Con 3-6 piezas, un algoritmo greedy de vecino más cercano es suficiente (no necesita TSP completo).

```typescript
function buildOptimalRoute(userPos: LatLng, pieces: GeoHuntPiece[]): GeoHuntPiece[] {
  const remaining = [...pieces];
  const ordered: GeoHuntPiece[] = [];
  let current = userPos;

  while (remaining.length) {
    const nearest = remaining.reduce((best, p) =>
      haversine(current, p) < haversine(current, best) ? p : best
    );
    ordered.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
    current = { lat: nearest.lat, lng: nearest.lng };
  }

  return ordered;
}
```

La ruta completa (`usuario → A → B → C`) se pasa a OSRM como **waypoints múltiples** en una sola llamada:

```
GET /route/v1/foot/{userLng},{userLat};{aLng},{aLat};{bLng},{bLat};{cLng},{cLat}
    ?overview=full&geometries=geojson&steps=true
```

Leaflet Routing Machine dibuja toda la ruta de una vez.

---

## Flujo técnico

```
[Usuario elige puzzle]
         │
         ▼
Extraer piezas relevantes del metadata del puzzle
         │
         ▼
GPS: obtener posición actual del usuario
         │
         ▼
Generar coords aleatorias en radio X desde el usuario
         │
         ▼
Para cada coord → OSRM /nearest → snap a calle más cercana
         │
         ▼
Algoritmo greedy → ordenar piezas por ruta óptima
         │
         ▼
OSRM /route (waypoints) → polyline de ruta completa
         │
         ▼
┌────────┴────────┐
│                 │
▼                 ▼
Vista MAPA       Vista AR
Leaflet +        A-Frame + AR.js
ruta dibujada    piezas en GPS coords
                 visibles por cámara
│                 │
└────────┬────────┘
         │
         ▼
GPS watch → Haversine cada 3s → ¿usuario a <20m de pieza?
         │
        SÍ
         │
         ▼
Pieza capturada → estado local actualizado → marcador revelado
         │
         ▼
¿Todas capturadas? → habilitar tablero → resolver puzzle
```

---

## Consideraciones técnicas

### Permisos en dispositivo
- **Geolocalización**: `navigator.geolocation` — solicitado al iniciar sesión.
- **Cámara** (solo vista AR): `getUserMedia` — solicitado al cambiar a modo AR.
- **Giroscopio/brújula** (solo AR): `DeviceOrientationEvent` — en iOS requiere `requestPermission()`.

### Batería y rendimiento
- Usar `watchPosition` con `{ maximumAge: 3000, enableHighAccuracy: true }`.
- Detener el watcher al salir del modo o al completar la sesión.
- AR.js es más costoso en batería — se puede ofrecer como modo opcional.

### Sin señal
- Las piezas y la ruta se calculan al inicio y se guardan en memoria.
- El mapa puede seguir funcionando con tiles cacheados (Leaflet cachea por defecto).
- Si se pierde GPS, mostrar último punto conocido + aviso.

### Radio recomendado
| Contexto | Radio |
|---|---|
| Ciudad / zona densa | 200–400m |
| Parque / zona abierta | 400–800m |
| Modo rápido (1 pieza) | 100–150m |

---

## AR — detalle técnico

[AR.js](https://ar-js-org.github.io/AR.js-Docs/) con el componente **location-based** posiciona entidades A-Frame en coordenadas GPS:

```html
<a-scene
  vr-mode-ui="enabled: false"
  arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false"
  renderer="antialias: true; alpha: true">

  <!-- La pieza de ajedrez como modelo 3D o imagen -->
  <a-entity
    gps-new-entity-place="latitude: 6.2442; longitude: -75.5812"
    gltf-model="#chess-queen"
    scale="5 5 5">
  </a-entity>

  <a-camera gps-new-camera="gpsMinDistance: 5"></a-camera>
</a-scene>
```

El modelo 3D de cada pieza puede ser un GLTF simple o incluso un plano con la imagen de la pieza.

**Soporte**: Chrome Android (excelente), Safari iOS 15+ (requiere permiso de giroscopio).

---

## Fases de implementación

### Fase 1 — MVP (mapa)
- [ ] Lógica de extracción de piezas relevantes desde metadata del puzzle
- [ ] Generación de coordenadas aleatorias en radio
- [ ] Integración OSRM snap-to-road
- [ ] Algoritmo de ruta óptima (greedy nearest neighbor)
- [ ] OSRM route con waypoints múltiples
- [ ] Integrar Leaflet + dibujar ruta completa
- [ ] GPS watch + detección de proximidad (Haversine)
- [ ] Estado local de sesión + revelado de piezas

### Fase 2 — AR
- [ ] Integrar A-Frame + AR.js location-based
- [ ] Modelos 3D o sprites de piezas de ajedrez
- [ ] Toggle mapa ↔ AR en la misma sesión
- [ ] Permisos de cámara y giroscopio en iOS

### Fase 3 — Pulido y reglas
- [ ] Resolver puzzle antes de capturar todas (modo arriesgado)
- [ ] Selector de nivel por número de piezas
- [ ] Radio configurable por tipo de zona
- [ ] Tiempo límite opcional
