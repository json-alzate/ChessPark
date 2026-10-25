# Informe de la mañana — manada y mapa del Chess Runner (noche del 2026-10-24 al 25)

> Escrito a las 06:40 por el relevo de las 06:30 (§6 del [protocolo](./protocolo-noche.md)); pulidos añadidos a las 07:05 y a las 07:35. Bitácora completa en
> [`estado.md`](./estado.md); informes de auditoría en `docs/local/noche/informes/` (no versionados). Sin commits ni deploy.

## Resumen

- **Las 12 piezas (P0–P11) están cerradas ✅.** Los diez personajes tienen sus 5 animaciones y su retrato, las 7 zonas del mapa
  tienen sus animaciones de ambiente, están los nodos y el mapa de papel, y la pantalla de prueba `chess-runner/laboratorio` funciona
  en vivo con los assets reales.
- **Horas reales trabajadas: ~8 h 20 min** (21:00–21:09, 22:00–~03:25, 04:00–06:45, 07:00–07:05 y 07:30–07:36).
- **Cortes por cuota: ninguno.** Hubo dos pérdidas de tiempo, y las dos fueron de relevos que murieron:
  - **21:09–22:00 (~50 min).** El primer relevo cerró su turno con dos subagentes en segundo plano y un refrescador del lock. Todo
    se perdió y el lock bloqueó al relevo de las 21:30. Tú mismo lo anotaste y reforzaste el protocolo. Después no volvió a pasar.
  - **~03:25–04:00 (~35 min).** El relevo de las 03:14 murió sin anotar a mitad de P7. Lo que dejó (zona 5) funcionaba y se
    aprovechó.
- **Medidas finales (06:35):**
  - Los cuatro `--check` dan OK: `export_pack.py` (61 archivos), `export_map.py` (94), `export_runner.py` (14) y
    `export_assets.py` (escena del directo, 20).
  - `python -m unittest` en `tools/stream-assets`: 68 OK, 0 saltadas.
  - En la app (P11, 06:25): pruebas del laboratorio y de las rutas, 7 suites con 131 pruebas OK. `nx build` OK.
  - `nx test chessColate` completo (P11, 06:11): 187 suites con 4027 pruebas. Hay SIGSEGV intermitentes de jest-worker con la
    máquina cargada, y las suites que caen pasan en verde al correrlas solas.
  - `nx lint chessColate` **falla por cosas ajenas a esta noche**: los 25 errores que ya existían y la build de Android ignorada
    por git. Los archivos del laboratorio tienen 0 errores y 0 avisos.

### Decisiones que deberías conocer

1. **Choco no se redibujó.** `pack_char_choco.py` reutiliza `runner.dog_animations()`, así que en el runner se ve idéntico. Solo en
   la manada lleva cuatro retoques para animar como los otros nueve:
   - estrellitas en `hurt`;
   - salto 5 px más bajo;
   - ojos «^» en `happy`;
   - retrato propio.

   No se tocaron `dog.py`, `runner.py` ni los assets del runner.
2. **El contrato no cuadra con la celda de Choco.** `ASSETS_SPEC.md` dice «Choco 52×40 / alto de celda 40», pero con la regla de
   celda fijada en P0 su celda da **54×43** (alto 42). No se cambió el contrato: decide tú cuál de los dos manda.
3. **Puntos por zona** (orden fijado por los constructores):
   - zonas 1–4: 8 puntos;
   - zonas 5–6: 7 (1–2 pattern · 3 rescue · 4–5 pattern · 6 camp · 7 boss);
   - zona 7: 9 (puertas y patrones, y termina en el Rey, en el trono).
4. **Mapa de papel:** 43 galletas (zonas 1–4: 6 cada una; zonas 5–6: 5 cada una; zona 7: 9). Cada parada de jefe está a la entrada
   de su zona y se empareja con la zona por su `boss`.
5. **Supuestos del laboratorio:**
   - la galleta dorada es la última de cada zona;
   - si falta un sprite de nodo, se usa `map-node-<kind>-done` (con los assets reales no hizo falta ninguna vez).
6. **Cambios de comportamiento en la app (P11):**
   - el mapa y el papel se ajustan al ancho de la pantalla (`fitScale()` + `ResizeObserver` aplazado). En 393 px van a ×1 porque a ×2
     se cortaban 81 px;
   - la huella del papel ya no tapa la cara de la ardilla cuando el progreso es 0.
7. **`dog_nannukk.py` y `preview_nannukk.py`** (el boceto de antes de la noche) quedan **obsoletos e intactos**. El Nannukk real está
   en `pack_char_nannukk.py` sobre `pack_body_husky.py`. Si los quieres borrar, hazlo tú.

## Por pieza

En las notas, el orden es: parecido / legibilidad / proporciones / animación / estilo. En el mapa es composición / puntos /
oscuridad / coherencia / ambientes.

| Pieza | Qué quedó (archivos en `tools/stream-assets/`) | Última auditoría | Flojo (deseables, no bloquean) |
|---|---|---|---|
| P0 Cimientos | `pack_common.py`, `export_pack.py`, `preview_pack.py`, `test_pack_assets.py`, `export_map.py`, `preview_map.py`, `test_map_assets.py`; descubren solos los `pack_char_*.py` y `map_*.py` | — (medido) | — |
| P1 Familia lab | `pack_body_lab.py`, `pack_char_choco.py`, `pack_char_tormenta.py`, `pack_char_tony.py`; celda 54×43 los tres | r3: retrato de Choco 8/8/8/8; Tormenta y Tony 8/8/8/8/8 | a 1× la oreja de Tony se ve algo erguida; corren algo encorvados frente a Choco; Tormenta queda más compacta que en las fotos |
| P2 Malamute/husky | `pack_body_husky.py`, `pack_char_kiana.py`, `pack_char_zack.py`, `pack_char_nannukk.py`; Kiana y Zack 58×47, Nannukk 70×56 | r2: los tres 8/8/8/8/8 | estrella canela junto al collar de Nannukk; oreja de carrera a 45°; silueta propia para Kiana y Zack (hoy comparten cuerpo); el plumero de Nannukk flota sobre la grupa al correr |
| P3 Pequeños | `pack_body_small.py`, `pack_char_romeo.py`, `pack_char_maryluna.py`, `pack_char_luna.py`; 45×36, 41×34 y 38×32 | r2: Romeo y Maryluna 8/8/8/8/8, Luna 9/8/8/8/8 | Romeo algo largo en `run`; a 2× la punta de su oreja se ve como un flequillo |
| P4 Gatita | `pack_body_cat.py`, `pack_char_gatita.py`; 35×29, la más pequeña; calicó pálida | r2: 8/8/8/8/8 | en `run` mide lo mismo de ancho que Luna; a 1× las patas de `run[1]`/`[3]` parecen una falda |
| P5 Zonas 1–2 | `mapkit.py` (base común, oscuridad horneada), `map_zone1.py` (Bosque, 5 ambientes), `map_zone2.py` (Praderas, 4) | r3: z1 8/9/9/8/8, z2 8/9/8/8/8 | la salida de la zona 1 no está marcada; solo dos copas se mecen (el tramo del arroyo a la derecha del puente, que tenía pocas rayitas, se arregló en el pulido de las 07:30) |
| P6 Zonas 3–4 | `map_zone3.py` (Selva), `map_zone4.py` (Cañón); 5 ambientes cada una | r2: z3 8/9/8/8/8, z4 8/8/8/8/8 | las lianas del arco parecen una reja; el humo sale continuo, no en bocanadas |
| P7 Zonas 5–6 | `map_zone5.py` (Sabana), `map_zone6.py` (Pantano/costa); 5 ambientes cada una, luz propia en brasa, destellos y luciérnagas | r2: z5 8/9/8/8/8, z6 8/9/9/8/8 | la hierba de la zona 5 parece una alfombra rectangular; la niebla queda arrinconada |
| P8 Zona 7 y nodos | `map_zone7.py` (guarida del Rey, 6 ambientes, luminancia 0.192), `map_nodes.py` (30 sprites, candado, puntito) | r2: z7 8/9/9/8/8, nodos 9/9/8/9/8 | `king-locked` se ve flojo en la zona 7; trono bajo; torres violeta sin luz (el corte del rayo en x = 60 se arregló en el pulido de las 07:00) |
| P9 Mapa de papel | `map_paper.py`: papeles d0/d1/d2, 3 galletas-tablero, 14 paradas, marcador | r2: 8/8/8/8/8 | viñetas pequeñas, ilegibles a ×2 (zanahoria, ruina, huesos, tablero); poco contraste en la tinta de arriba del d2 |
| P10 Laboratorio | app: `pages/pack-lab`, `components/pack-sprite`, `components/pack-lab-map`, `services/pack-assets.service.ts`, `utils/pack-*.util.ts`, `models/pack.model.ts`, sus specs, la ruta, `PACK_LAB` en es/en y `ARQUITECTURA.md` | r3: 9/9/8/9/9 | falta un modo «juntos» para ver a los 10 sin desplazar; el cielo se estira a una escala no entera |
| P11 Ensamblado | export completo, recorrido en vivo y coherencia de los diez | coherencia r3: 8/8/8/8/8; revisión de código sin bugs graves | **M2**: falta el rótulo «×1 · ajustado al ancho» (textos es/en, a tu criterio) |

**Pulido de las 06:30**, en `pack_char_choco.py`: Choco ya cierra los ojos en «^» en `happy` y su retrato sube 4 px, para quedar
alineado con los otros nueve. Solo cambian `pack-choco-happy.png` y `pack-choco-portrait.png`. Así se cierran los dos primeros
deseables de `P11-manada-r3.md`. Estos dos cambios no tuvieron auditoría propia: son el arreglo literal que proponía el informe, y
los miré en `docs/local/noche/pulido-choco/zoom-happy.png`.

**Pulido de las 07:00**, en `map_zone7.py` (`sky_color`): el destello del rayo ya no se corta en seco en el borde de su caja
(x = 60). Ahora se desvanece en los últimos 11 px. Medido con `auditoria-p8-r1/edge.py`, luz media del cielo en el cuadro 6: entre
x = 58 y x = 60 había un salto de 40 a 33, y ahora baja en rampa (52 → 44 → 42 → 36 → 34 → 33); hasta x = 48 queda igual. Solo cambia
`map-fx-7-relampagos.png`; la escena y los otros 93 archivos del mapa son idénticos. Lo miré en
`docs/local/noche/pulido-rayo/antes-despues-f6-x4.png` y en la tira `docs/local/preview/map-zone-7-anim.png`. Tampoco tuvo
auditoría propia: es el arreglo D7 de `P8-r1.md`. Medidas tras el cambio (07:05): los cuatro `--check` OK y unittest 68 OK.

**Pulido de las 07:30**, en `map_zone1.py` (`_fx_arroyo`): el tramo del arroyo a la derecha del puente (`map-fx-1-arroyo2`) se veía
casi quieto. Ahora lleva más rayitas de corriente (`dense`/`fill` 0.85/0.4 en ese tramo; el izquierdo sigue en 0.55/0.25): de ~22 a
~40 píxeles animados por cuadro. Antes de exportar, el `--check` solo marcaba `map-fx-1-arroyo2.png` como distinto; el tramo
izquierdo es idéntico byte a byte. Lo miré en `docs/local/noche/pulido-arroyo/antes.png` y `despues.png`. Sin auditoría propia: es
el deseable de `P5-r3.md`. Medidas tras el cambio (07:34): los cuatro `--check` OK y unittest 68 OK.

## Cómo verlo

1. Levanta la app con `~/.local/bin/devctl up chesscolate`. Tarda en compilar.
2. Abre **https://mac-mini-de-jheison.tail23d06b.ts.net:8443/chess-runner/laboratorio**. No tiene enlace en ningún menú.
3. Qué hay en el laboratorio:
   - botones para elegir uno o varios personajes;
   - la animación que quieras, a 1× o 2×;
   - las zonas 1–7 con el interruptor de las animaciones de ambiente;
   - los estados de cada punto;
   - el papel d0/d1/d2, con un deslizador de 0 a 43 galletas.
4. Dónde están las cosas:
   - capturas del recorrido en vivo: `docs/local/noche-p11/01..33.png` (393×852);
   - vistas previas de los sprites: `docs/local/preview/` (`pack-sizes.png`, `pack-1x2x.png`, `map-zones.png`, `map-paper.png`…).
5. Para regenerar todo: `cd tools/stream-assets && ./.venv/bin/python export_pack.py && ./.venv/bin/python export_map.py` (y
   `--check` para verificar sin escribir).

## Lo que no se hizo

- Los deseables de la tabla de arriba. Ninguno baja de 8 y se dejaron así por el límite de rondas.
- El rótulo M2 del laboratorio.
- El modo «juntos» del laboratorio.
- **La manada y el mapa no están conectados al juego real.** Solo los usa el laboratorio. No se tocó el Chess Runner ni su
  selección de personaje.
- `nx lint chessColate` sigue en rojo por los 25 errores que ya existían, ajenos a esta noche.
- No se corrió la suite E2E de Playwright (`apps/chessColate-e2e`). El recorrido en vivo se hizo con Playwright MCP.

## Supuestos provisionales que tienes que confirmar

- **Collares**: están en `META` de cada `pack_char_*.py` y se cambian con una línea.

  | Personaje | Collar provisional |
  |---|---|
  | Choco | verde `#7fd35a` con franja naranja `#f0903c` (el de siempre) |
  | Tormenta | amarillo `#ffd23f` |
  | Tony | naranja `#ff8a2b` |
  | Kiana | azul `#4fa3ff` |
  | Zack | violeta `#b46cff` |
  | Nannukk | rosa `#ee6f86` |
  | Romeo | rojo `#e5483f` |
  | Maryluna | negro con franja rosa `#ff6fb0` |
  | Luna | turquesa `#36d1c4` |
  | Gatita | celeste `#9be7ff` |

  Tormenta y Romeo tienen poco contraste entre el collar y el pelaje.
- **Tallas**, como celda ancho×alto:

  | Personajes | Talla | Celda |
  |---|---|---|
  | Choco, Tormenta y Tony | M | 54×43 |
  | Kiana y Zack | L | 58×47 |
  | Nannukk | XL | 70×56 |
  | Romeo | S–M | 45×36 |
  | Maryluna | S | 41×34 |
  | Luna | S | 38×32 |
  | Gatita | S | 35×29 |

  Confirma sobre todo si Nannukk debe ser tan grande y si Tormenta y Tony deben medir lo mismo que Choco.
- **El orden y el número de puntos por zona**, y el reparto de las 43 galletas del papel (decisiones 3 y 4).

## En el árbol de trabajo, sin commitear

Lo de esta noche:

- `tools/stream-assets/`: módulos `pack_*` y `map_*`, `mapkit.py`, los exportadores, las vistas previas, las pruebas y `README.md`.
- `apps/chessColate/src/assets/images/pack/` y `.../map/`.
- Los archivos del laboratorio de la app, `app.routes.ts` y su spec, `es.json`/`en.json` (solo claves `PACK_LAB`) y
  `docs/ARQUITECTURA.md`.
- `docs/personajes/`.

Hay dos cosas que no parecen de esta noche: `.firebase/hosting…cache` (modificado) y `assetPerros/`. No las tocó ningún relevo y
quedan fuera.
