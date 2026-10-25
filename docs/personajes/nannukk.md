# Nannukk

## En una línea

Alaskan malamute grande y esponjoso, la mayor de la manada.

## Cómo se ve

- **Pelaje y colores:** manto gris acero en el lomo y los flancos, con el antifaz casi negro alrededor de los ojos; cara y
  pecho crema; hocico, panza y patas blancos; cejas canela (dos puntitos sobre los ojos).
- **Rasgos que lo distinguen:** orejas paradas y puntiagudas (por dentro, rosadas); mejillas muy esponjosas; **cola grande
  enroscada sobre el lomo, con la punta blanca**; ojos pequeños y oscuros.
- **Collar:** ❓ en las fotos se ve rosado o rojizo. En el sprite de prueba es **rosa** (`#ee6f86`) con franja clara y chapita
  dorada. Confirmar el color real.
- **Foto de referencia:** `assetPerros/Photos-1-001.zip` (sin nombre en el zip). Mejores tomas: de lado sobre la cama
  (`IMG_20240426_170523.jpg`) y de frente (`IMG_20241111_220222.jpg`).

## Personalidad

❓ Pendiente de contar.

## Talla y jugabilidad

- **Talla:** **XL**. Su cuadro es de **68×55** (Chocolate, 52×40): unas 1,3 veces más grande.
- **Cómo corre y salta:** ❓ (idea: potente, pero pesada).
- **Fortaleza y debilidad:** ❓

## Poder y habilidades

❓ Pendiente de contar.

## En la historia

❓ Pendiente.

## Estado de los sprites

✅ **Hecho, sin conectar al juego** (solo lo usa el Laboratorio de la manada). Celda de **70×56** (la mayor de la manada). Cuerpo de
malamute en `tools/stream-assets/pack_body_husky.py` (compartido con Kiana y Zack, con otra talla) y sus datos en
`pack_char_nannukk.py`: `run` (4 cuadros), `jump` (3), `hurt` (2), `idle` (2) y `happy` (2), más el retrato de 32×32.

```bash
cd tools/stream-assets
./.venv/bin/python preview_pack.py --only nannukk   # hoja de contacto y comparación de tamaños en docs/local/
./.venv/bin/python export_pack.py                   # escribe assets/images/pack/ y pack.json
```

Auditoría final (ronda 2): parecido, legibilidad, proporciones, animación y estilo en 8 o más. Lo que queda flojo: una estrella canela
junto al collar; la oreja de carrera a 45°; el plumero de la cola flota sobre la grupa al correr. El **collar rosa sigue siendo provisional**.
