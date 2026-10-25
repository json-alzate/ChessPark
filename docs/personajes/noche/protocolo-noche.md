# Protocolo de la noche — la manada y el mapa del Chess Runner

> Lo ejecuta cada agente que lanza el schedule de Paseo («ChessPark: noche de assets»), cada 30 min entre las 21:00 y las 08:00
> (America/Bogota). **Cada agente empieza sin memoria: todo lo que necesita está en archivos.** Contexto del encargo y bitácora:
> `estado.md` (en esta carpeta). El contrato de los assets: [`../ASSETS_SPEC.md`](../ASSETS_SPEC.md). Es el mismo método que la noche
> de Tormenta, y por la misma razón: el primer intento allí murió por cuota con muchos subagentes en paralelo.

## 0. Antes de leer nada más (comando, no lectura)

Desde `/Users/jheisonalzate/Documents/Projects/ChessPark`:

```bash
N=docs/local/noche
[ -f $N/PARAR ] && echo "PARAR" ; \
[ -f $N/.lock ] && echo "lock hace $(( $(date +%s) - $(cat $N/.lock) )) s" ; \
[ -f $N/.inicio_epoch_noche ] || echo "sin orden" ; \
date '+%F %T'
```

- Existe `PARAR` → termina con una línea: «detenido por PARAR». No hagas nada más.
- El lock tiene **menos de 2.100 s (35 min)** → hay otro agente vivo. Termina con una línea: «otro agente activo». No leas ni escribas más.
- Dice «sin orden» → el autor no ha dado la orden de arrancar. Termina: «sin orden».
- Hora Bogotá entre 08:01 y 20:59 → termina: «fuera de la ventana nocturna».
- Si pasas todos los filtros: `date +%s > $N/.lock` y sigue. **Refresca el lock** después de cada unidad de trabajo (cada auditoría, cada
  pieza o cada ≤10 min). Al terminar tu turno, borra el lock.

## 1. Orientación (máx. 5 min)

1. Lee `estado.md` (tabla de piezas y bitácora) y este protocolo. Lee el contrato (`ASSETS_SPEC.md`) solo de la parte que toca tu pieza.
2. Elige la pieza (§2) y anota en la bitácora: hora + pieza + qué vas a hacer.

## 2. Qué toca

Las piezas están en la tabla de `estado.md`. **Una a la vez.** Prioridad:

1. **P0 Cimientos** (exportador de la manada y del mapa, con `--check`, vista previa y pruebas) si está ☐: sin eso, nadie puede probar nada.
2. Luego, **en este orden** (cada una hasta su auditoría): P1 familia lab (Choco, Tormenta, Tony) → P2 familia malamute/husky (Nannukk,
   Kiana, Zack) → P3 familia pequeños (Romeo, Maryluna, Luna) → P4 la gatita → P5 mapa zonas 1–2 → P6 zonas 3–4 → P7 zonas 5–6 → P8
   zona 7 y nodos → P9 mapa de papel → P10 Laboratorio (la pantalla de prueba).
3. Una pieza ya construida pero sin auditar pasa por delante de empezar otra nueva (§4).
4. **P11 Ensamblado y prueba en vivo** solo cuando todas las anteriores estén ✅ (o tengan 3 rondas hechas).
5. Si todo está ✅, usa el tiempo en **pulir**: re-audita con otro enfoque lo más flojo del informe (§4) y mejóralo.

El **Laboratorio (P10)** se puede adelantar si sobra tiempo mientras una auditoría espera, porque solo depende de `pack.json` y `map.json`.

## 3. Cómo se construye una pieza

- Lee: `ASSETS_SPEC.md`, las **fotos de referencia** `docs/local/referencias/<id>-N.jpg` (míralas con `Read`), y los módulos que ya existan
  (`tools/stream-assets/dog.py`, `dog_nannukk.py`, `cat.py`, `pixel.py`, `runner.py`) para respetar el estilo de Choco.
- Escribe con subagente o tú mismo. **Máx. 1 pieza a la vez por subagente y máx. 2 subagentes simultáneos en toda la noche.** Nada de lanzar
  seis en paralelo.
- **No termines tu turno con subagentes vivos. Esta regla es de hierro** (ya falló dos veces: Tormenta y la primera noche de esta; los
  subagentes mueren cuando termina el turno del agente que los lanzó y se pierde su trabajo). Lánzalos **en primer plano** (sin
  `run_in_background`) y espera su resultado en esa misma llamada. Si uno tarda mucho, **sigue esperando**: no cierres tu turno diciendo
  «siguen trabajando». Si falla, haz tú la pieza.
- **Prohibido dejar un «refrescador» del lock en segundo plano** (un bucle que toque `.lock` o `.refresco`): si el agente muere, el lock sigue
  fresco y bloquea a los relevos siguientes durante 35 min. El lock se refresca **a mano**, tras cada unidad de trabajo.
- Trabaja siempre con el entorno de los scripts: `cd tools/stream-assets && ./.venv/bin/python …`. Las vistas previas van a `docs/local/preview/`
  y se miran con `Read` (ahí se ve el sprite, no se adivina).
- «Hecho» se dice **solo** tras medir: `export_pack.py --check` / `export_map.py --check`, `python -m unittest` y el `preview` mirado. Los
  `--check` y las pruebas del resto de assets (`export_runner.py --check`, `export_assets.py --check`) **siguen en verde**.
- Trabajo a medias: `docs/local/noche/pendiente/<pieza>.md` (qué falta), no código roto en `tools/` ni en `apps/`.
- Si tocas la app (`apps/chessColate`): lee antes `docs/ARQUITECTURA.md` y la skill `ui-style-guide` + `docs/STYLE_GUIDE.md`; `nx` para todo
  (`nx test chessColate`, `nx lint chessColate`); no reformatear `es.json`/`en.json`; actualizar `ARQUITECTURA.md` si cambia una capa.

## 4. Auditoría e iteración (para cada pieza)

- Audita con un subagente **distinto del que construyó**, con ojos frescos, mirando los PNG y las fotos. Rúbrica (nota 1–10 cada punto):
  1. **Parecido** con su perro/gata (colores, rasgos que lo distinguen, collar).
  2. **Legibilidad** a 1× y 2× (se entiende qué es y qué hace en cada pose).
  3. **Proporciones y talla** respecto a Choco y a los demás (tabla de tallas de `ASSETS_SPEC.md`).
  4. **Animación**: pies en la base, cuadros que no «saltan», `hurt` que se entiende como choque, `jump` con sus tres fases, ciclo de `run`.
  5. **Coherencia de estilo** con Choco y con el resto de la manada.
  Para el mapa, en su lugar: composición y camino, legibilidad de los puntos, **oscuridad progresiva**, coherencia entre zonas y
  **animaciones de ambiente** (que se vean vivas, que el bucle no salte, que no tapen el camino ni los puntos; se miran en la tira
  animada que genera `preview_map.py`).
- La auditoría deja un informe en `docs/local/noche/informes/<pieza>-rN.md` con la nota de cada punto y **lo concreto a cambiar** (qué sprite,
  qué cuadro, qué color).
- Cualquier punto **< 8** → se corrige lo que el informe señala y se vuelve a auditar. **Máximo 3 rondas por pieza.** Tras la ronda 3 se da la
  pieza por cerrada y lo que quede flojo se anota en la bitácora y en el informe de la mañana, sin adornos.
- La pieza pasa a ✅ solo cuando todas las notas son ≥ 8 o ya van 3 rondas.

## 5. Cuota

- Si una llamada falla con «session limit» / HTTP 429 / «usage limit»: **no reintentes en bucle.** Anota en la bitácora la hora y lo que
  quedó a medias, borra el lock y termina. El siguiente disparo del schedule retoma cuando la cuota se haya reiniciado.
- Nada de dejar trabajo a medias sin anotar.

## 6. Informe de la mañana (obligatorio, el último agente antes de las 08:00)

Cualquier relevo que arranque a las **07:00 o más tarde** termina lo que tenga en curso y escribe `docs/personajes/noche/informe-de-la-manana.md`:

- Al principio: **horas reales trabajadas** (suma de la bitácora), cortes por cuota (hora y duración) y decisiones tomadas que Jheison debería conocer.
- Para cada pieza: qué se hizo (archivos, medidas verificadas), notas de la última auditoría, qué quedó flojo y por qué, estado resultante.
- Cómo ver el resultado: comando para levantar la app (`devctl`), la ruta del laboratorio y dónde están las capturas.
- Lo que no se hizo, sin adornos. Y los **supuestos provisionales** (collares y tallas) que hay que confirmar.

## 7. Prohibido

- Commits, pushes, ramas, deploys. Tocar `apps/live-stream/` o la carpeta de producción del directo.
- Modificar los assets del runner actual (`assets/images/runner/`, `runner.json`, `runner.py`, `dog.py`, `cat.py`, `export_runner.py`).
- Borrar nada que no hayas creado tú (si algo sobra, se mueve a `docs/local/noche/descartes/`).
- Escribir «hecho» sin haber medido. Reformatear archivos ajenos.
