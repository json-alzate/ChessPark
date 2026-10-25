# Personajes del Chess Runner

La manada del Chess Runner: mascotas reales convertidas en personajes jugables, cada una con su collar, su personalidad,
su poder y sus habilidades. Este espacio es la **fuente de verdad** de quiénes son: de aquí salen los sprites
(`tools/stream-assets/`), los textos del juego y la historia.

> **Cómo se usa.** Cada personaje tiene su ficha (`<nombre>.md`, copiando [PLANTILLA.md](./PLANTILLA.md)). Lo que está en la
> ficha manda; lo que falte se marca `❓` y se pregunta antes de dibujarlo o programarlo. La historia, el mapa y la
> jugabilidad van en [HISTORIA.md](./HISTORIA.md).

## La manada

| Personaje | Qué es | Collar | Tamaño | Ficha | Sprites |
|---|---|---|---|---|---|
| **Chocolate** («Choco» en el juego) | Perro marrón oscuro (hoy el único del juego) | verde con franja naranja | M (referencia) | ❓ | ✅ en el juego |
| **Nannukk** | Alaskan malamute | ❓ (rosa de prueba) | XL | [nannukk.md](./nannukk.md) | 🧪 prueba |
| Kiana | Husky rojizo | ❓ | ❓ | ❓ | — |
| Romeo | Perrito canela de pelo áspero | ❓ | ❓ | ❓ | — |
| Luna | Chihuahua beige | ❓ | ❓ | ❓ | — |
| Maryluna | Perrita crema de pelo hirsuto, collar rosa y negro en la foto | ❓ | ❓ | ❓ | — |
| Tony | Perro negro de pecho blanco | ❓ | ❓ | ❓ | — |
| Tormenta | Perro canela de tamaño medio | ❓ | ❓ | ❓ | — |
| Zack | Husky de ojos azules | ❓ | ❓ | ❓ | — |
| La gatita | Gatita atigrada blanca y naranja | ❓ | S | ❓ | — |

Los nombres de Kiana a Zack son los de los zips de fotos; se corrigen aquí si alguno no corresponde. **Chocolate pasa a ser
un personaje más de la manada**: su ficha se escribe como las demás.

## Reglas de tamaño

Todos comparten escala y se respetan las proporciones entre ellos, pero **tienen que verse bien en la carrera**: saltar las
piezas, esquivar y leerse de lejos en un móvil.

- **Escala común:** 1 px del sprite = 1 px lógico; la app lo amplía por un número entero (nada de fracciones).
- **Chocolate es la medida:** su cuadro es de **52×40**. Los demás se miden contra él.
- **Cuatro tallas** (propuesta, a confirmar), para que los hitboxes y los saltos sean pocos y predecibles:

  | Talla | Alto aprox. del cuadro | Ejemplos |
  |---|---|---|
  | S | ~30 px | gatita, chihuahua |
  | M | ~40 px (Chocolate) | la mayoría |
  | L | ~46 px | husky |
  | XL | ~55 px | Nannukk |

- **Mismo cuadro por personaje:** todas sus poses (correr, saltar, golpe, contento y quieto) miden lo mismo, con los **pies
  abajo** y mirando a la **derecha**. Así cambiar de personaje no mueve nada en la pantalla.
- **Lo que cambia con la talla es el juego, no solo el dibujo:** un personaje grande salta menos alto o choca antes; uno
  pequeño es ágil pero frágil. Eso se decide en cada ficha (sección *Talla y jugabilidad*) y se programa aparte.
- **Siempre se ve su collar:** cada uno tiene el suyo de un color propio, y es lo que los distingue a primera vista. El color
  tiene que contrastar con su pelaje y entre ellos no se parecen.

## Cómo se convierte una mascota en sprites

1. Las **fotos** de referencia viven fuera del repo (`assetPerros/`, sin versionar: pesan 333 MB). Se miran para sacar la
   paleta y los rasgos que la distinguen.
2. La ficha fija **rasgos, paleta, collar y talla**. Si algo no se ve bien en la foto, la ficha lo corrige.
3. Se dibuja **por código** en `tools/stream-assets/` (un módulo `pack_char_<id>.py` por personaje, sobre el cuerpo de su familia `pack_body_<familia>.py`), con las mismas poses y
   ritmos que Chocolate (`run`, `jump`, `hurt`, `happy`, `idle`) más las de sus habilidades.
4. Se revisa en la hoja de contacto (`preview_pack.py`) y se exporta con `export_pack.py` a `assets/images/pack/` con su `pack.json`.
   Se ve en movimiento en el **Laboratorio de la manada** (`/chess-runner/laboratorio`). Ver [ASSETS_SPEC.md](./ASSETS_SPEC.md).

## Qué falta por decidir

- ~~Cómo se desbloquea cada mascota~~ ✅: se **rescatan en las zonas** del mapa (ver [HISTORIA.md](./HISTORIA.md#la-manada-en-la-historia)). Falta decidir quién va en qué zona.
- Qué pasa con los pelajes del armario (hoy son del perrito): ¿son de Chocolate, o cada mascota tiene los suyos?
- Cuántos sprites extra pide cada habilidad.
