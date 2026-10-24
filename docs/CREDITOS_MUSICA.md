# Créditos de la música del directo 24/7

Música instrumental de fondo del canal de puzzles lofi. **Generado** por `tools/stream-runner/music-credits.mjs`
a partir de `tools/stream-runner/music/manifest.json`; no se edita a mano.

El canal es **monetizable**, así que solo se admiten licencias que lo permiten: **CC BY** (con atribución) y
**CC0** (sin condiciones). Se descartaron las licencias NC (no comercial), ND (sin derivadas, porque se
normaliza el volumen) y SA (compartir igual).

## Resumen

| Licencia | Pistas | Autores | Minutos |
|---|---:|---:|---:|
| [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 79 | 35 | 274.7 |
| [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 5 | 1 | 18.2 |
| [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 3 | 3 | 14.4 |
| **Total** | **87** | **37** | **307.4** |

Máximo 6 pistas por autor, para repartir el riesgo de reclamos de Content ID.

## Cómo se verificó la licencia

- **ccMixter (82 pistas):** en la página de cada pista, el enlace `rel="license"` apunta a la licencia
  declarada (CC BY 3.0 o CC0). Se guardó la página como evidencia en `tools/stream-runner/music/licencias/`.
- **Chris Zabriskie (5 pistas, vía Wikimedia Commons):** la página de Commons declara CC BY 4.0 pero figura
  como *"License review needed"* (sin revisar por voluntarios). Se confirmó en la web del propio autor
  (chriszabriskie.com/use): *"All of my music is free to use … CC BY 4.0 · Commercial use OK · Credit required"*.
- Se contrastaron 6 pistas al azar de ccMixter contra la web **en vivo** el día de la verificación (2026-10-12).

## Atribución obligatoria

Las licencias CC BY exigen dar crédito. Hay que pegar este bloque en la **descripción del directo**
(también en `tools/stream-runner/music/DESCRIPCION_MUSICA.txt`) y publicar esta lista de pistas en la URL que se indica:

```text
Music (instrumental, used under Creative Commons licenses):

CC BY 3.0 - https://creativecommons.org/licenses/by/3.0/
_ghost, @nop, Admiral Bob, airtone, Alex, Apoxode, Aussens@iter, Bocrew, cdk, Darkroom, Doxent Zsigmond, Dub Alta Fidelidad, duckett, geoffpeters, go1dfish, gurdonark, Hans Atom, Ivan Chew, Jeris, Joel Frijters, Kirkoid, Mana Junkie, moscardo, oldDog, onlymeith, Pitx, Robbero, Skill_Borrower, Skye Jordan, smilingcynic, Speck, spinmeister, Stefan Kartenberg, unreal_dm, Wired Ant

CC BY 4.0 - https://creativecommons.org/licenses/by/4.0/
Chris Zabriskie

CC0 (public domain) - https://creativecommons.org/publicdomain/zero/1.0/
jaspertine, Pitx, spinmeister

Full track-by-track credits and links: https://chesscolate.web.app/settings/credits
```

## Riesgos y límites

- **Content ID:** una licencia libre no evita reclamos automáticos. Un autor o un editor puede registrar una pista
  en Content ID y reclamar el directo. Las 5 pistas de Zabriskie figuran con un editor ASCAP. No se pudo
  comprobar qué autores están registrados. Si llega un reclamo, se disputa citando la licencia y esta evidencia.
- **Prueba de derechos:** subir las pistas como videos privados (`rights-check.mjs`) detectó reclamos de Content ID en 1 pista(s), ya **retirada(s)** de la lista:
  - Robbero – Whisper: Content ID: coincide con «Quanto Tempos Mais» \(Nine\), reclamante ONErpm en nombre de 3x3 Records; efecto: limitación de ingresos. 4 tramos entre 39:24 y 41:39 del video 5 de la prueba de derechos \(2026-10-13\). Es un remi
- **Sin escuchar:** que sean instrumentales y suaves se basa en las etiquetas de ccMixter (82 de 87 llevan
  `instrumental`; las 5 de Zabriskie no tienen etiquetas), el BPM declarado y mediciones de volumen. Conviene
  oír una muestra de cada autor (`prepare-music` y `music-sample`).
- **Remezclas:** 53 pistas de ccMixter son remezclas con material de otros autores (lista abajo). ccMixter exige
  licencias compatibles, pero no se verificó la licencia de cada pista de origen por separado.
- **Material descartado:** las pistas rechazadas y el motivo están en `tools/stream-runner/music/descartadas.json`.

## Pistas (87)

| # | Título | Autor | Fuente | Licencia | Dur. |
|--:|---|---|---|---|--:|
| 1 | Infinite Sorrows | @nop | [ccMixter](https://ccmixter.org/files/Lancefield/51754) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:46 |
| 2 | Warm Ink | \_ghost | [ccMixter](https://ccmixter.org/files/_ghost/37481) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:03 |
| 3 | Confederation Line | Admiral Bob | [ccMixter](https://ccmixter.org/files/admiralbob77/60909) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 1:57 |
| 4 | High Above the Darkness \(My Star\) | Admiral Bob | [ccMixter](https://ccmixter.org/files/admiralbob77/62876) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:41 |
| 5 | Recovered Memory | Admiral Bob | [ccMixter](https://ccmixter.org/files/admiralbob77/48207) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:20 |
| 6 | The Broken | Admiral Bob | [ccMixter](https://ccmixter.org/files/admiralbob77/33304) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:43 |
| 7 | bluenotes | airtone | [ccMixter](https://ccmixter.org/files/airtone/64427) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:49 |
| 8 | bsides | airtone | [ccMixter](https://ccmixter.org/files/airtone/66822) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:48 |
| 9 | lostTrack | airtone | [ccMixter](https://ccmixter.org/files/airtone/64772) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:21 |
| 10 | roboduck | airtone | [ccMixter](https://ccmixter.org/files/airtone/66098) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:54 |
| 11 | shimmer | airtone | [ccMixter](https://ccmixter.org/files/airtone/64622) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:15 |
| 12 | spacedust | airtone | [ccMixter](https://ccmixter.org/files/airtone/64741) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:18 |
| 13 | Improvisation On Friday... | Alex | [ccMixter](https://ccmixter.org/files/AlexBeroza/17253) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:37 |
| 14 | Improvisation On Sunday... | Alex | [ccMixter](https://ccmixter.org/files/AlexBeroza/17112) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:54 |
| 15 | Purple Nurple | Alex | [ccMixter](https://ccmixter.org/files/AlexBeroza/27187) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:11 |
| 16 | Out for a Stroll | Apoxode | [ccMixter](https://ccmixter.org/files/Apoxode/59143) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:30 |
| 17 | The Parting Glass \(Instrumental\) | Aussens@iter | [ccMixter](https://ccmixter.org/files/tobias_weber/57892) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:07 |
| 18 | GOOD NIGHT | Bocrew | [ccMixter](https://ccmixter.org/files/BOCrew/31612) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:53 |
| 19 | Passing Through | Bocrew | [ccMixter](https://ccmixter.org/files/BOCrew/70818) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:29 |
| 20 | SUNBIRDS | Bocrew | [ccMixter](https://ccmixter.org/files/BOCrew/38854) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:52 |
| 21 | pieces of life | cdk | [ccMixter](https://ccmixter.org/files/cdk/16992) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:47 |
| 22 | ＭＩＬＬＥＮＮＩＡＬＳ | cdk | [ccMixter](https://ccmixter.org/files/cdk/57150) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:17 |
| 23 | A New Day in a New Sector | Chris Zabriskie | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chris_Zabriskie_-_02_-_A_New_Day_in_a_New_Sector.ogg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 3:06 |
| 24 | Divider | Chris Zabriskie | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chris_Zabriskie_-_06_-_Divider.ogg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 3:22 |
| 25 | The 49th Street Galleria | Chris Zabriskie | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chris_Zabriskie_-_05_-_The_49th_Street_Galleria.ogg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 3:56 |
| 26 | What Does Anybody Know About Anything | Chris Zabriskie | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chris_Zabriskie_-_02_-_What_Does_Anybody_Know_About_Anything.ogg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 4:17 |
| 27 | Your Mothers Daughter | Chris Zabriskie | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Chris_Zabriskie_-_03_-_Your_Mothers_Daughter.ogg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 3:34 |
| 28 | Down the Lighted Path | Darkroom | [ccMixter](https://ccmixter.org/files/mactonite/13876) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:20 |
| 29 | Static | Darkroom | [ccMixter](https://ccmixter.org/files/mactonite/29469) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:31 |
| 30 | Distant Memory | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/48045) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:20 |
| 31 | Falling Leaves | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/47748) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:60 |
| 32 | Mellow Piano | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/39616) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:02 |
| 33 | Modest Gramz PhD \(Piano Improvisation\) | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/59384) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:27 |
| 34 | Nocturnal | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/51454) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:22 |
| 35 | Piano Song For Goodnight | Doxent Zsigmond | [ccMixter](https://ccmixter.org/files/doxent/47797) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:40 |
| 36 | Good Night | Dub Alta Fidelidad | [ccMixter](https://ccmixter.org/files/dubaltafidelidad/61458) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:40 |
| 37 | Solstice Contemplation | duckett | [ccMixter](https://ccmixter.org/files/duckett/34934) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:56 |
| 38 | Piece of Quiet | geoffpeters | [ccMixter](https://ccmixter.org/files/geoffpeters/31391) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:00 |
| 39 | Alex's Remix | go1dfish | [ccMixter](https://ccmixter.org/files/go1dfish/39208) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:22 |
| 40 | Homework | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/29021) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:55 |
| 41 | Longing | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/43947) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:07 |
| 42 | Lost in Memory | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/37767) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:59 |
| 43 | Playground | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/17242) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:10 |
| 44 | Sensitive | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/35631) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:13 |
| 45 | Statia | gurdonark | [ccMixter](https://ccmixter.org/files/gurdonark/19368) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:45 |
| 46 | Death of a Music Box | Hans Atom | [ccMixter](https://ccmixter.org/files/hansatom/34478) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:33 |
| 47 | Dream On This Side \(instrumental\) | Ivan Chew | [ccMixter](https://ccmixter.org/files/ramblinglibrarian/35789) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:18 |
| 48 | Dreaming of the Ocean | Ivan Chew | [ccMixter](https://ccmixter.org/files/ramblinglibrarian/34231) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:29 |
| 49 | Song Title Indicates Meaning | jaspertine | [ccMixter](https://ccmixter.org/files/jaspertine/50957) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 4:51 |
| 50 | 3 pound universe | Jeris | [ccMixter](https://ccmixter.org/files/VJ_Memes/41544) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:04 |
| 51 | Sitting Back - Guitars | Joel Frijters | [ccMixter](https://ccmixter.org/files/KungFuFrijters/37187) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:49 |
| 52 | Improvisation on a Beach Blanket | Kirkoid | [ccMixter](https://ccmixter.org/files/Kirkoid/32432) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:37 |
| 53 | Shiro \(Kirkoid Mix\) | Kirkoid | [ccMixter](https://ccmixter.org/files/Kirkoid/43938) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:03 |
| 54 | Space Bazooka | Kirkoid | [ccMixter](https://ccmixter.org/files/Kirkoid/43005) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:14 |
| 55 | Reflections in the Rain | Mana Junkie | [ccMixter](https://ccmixter.org/files/mana_junkie/34419) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:53 |
| 56 | Staying together as the first time | moscardo | [ccMixter](https://ccmixter.org/files/moscardo/60242) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:13 |
| 57 | harp from Nube | oldDog | [ccMixter](https://ccmixter.org/files/oldDog/10226) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:31 |
| 58 | too quiet \(instr.\) | oldDog | [ccMixter](https://ccmixter.org/files/oldDog/17294) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:14 |
| 59 | too quiet \(piano\) | oldDog | [ccMixter](https://ccmixter.org/files/oldDog/17322) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:09 |
| 60 | Quiet Hours | onlymeith | [ccMixter](https://ccmixter.org/files/onlymeith/39658) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 5:40 |
| 61 | Quiet Rain | onlymeith | [ccMixter](https://ccmixter.org/files/onlymeith/33867) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:38 |
| 62 | Tendency | onlymeith | [ccMixter](https://ccmixter.org/files/onlymeith/39461) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:44 |
| 63 | Truth? | onlymeith | [ccMixter](https://ccmixter.org/files/onlymeith/38010) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:44 |
| 64 | Bye Bye 2010 | Pitx | [ccMixter](https://ccmixter.org/files/Pitx/29923) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:41 |
| 65 | Kids | Pitx | [ccMixter](https://ccmixter.org/files/Pitx/26358) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 1:30 |
| 66 | Long Winter | Pitx | [ccMixter](https://ccmixter.org/files/Pitx/19388) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 1:41 |
| 67 | Sunday Afternoon | Pitx | [ccMixter](https://ccmixter.org/files/Pitx/29173) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 3:36 |
| 68 | Long Live Blind Joe | Robbero | [ccMixter](https://ccmixter.org/files/Robbero/59218) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:29 |
| 69 | Mountains \(Hip hop instrumental\) | Robbero | [ccMixter](https://ccmixter.org/files/Robbero/42877) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:48 |
| 70 | mysterious light bells | Robbero | [ccMixter](https://ccmixter.org/files/Robbero/40042) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 1:56 |
| 71 | Sad Night | Robbero | [ccMixter](https://ccmixter.org/files/Robbero/63869) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:19 |
| 72 | Spheres \(Hip Hop Instrumental\) | Robbero | [ccMixter](https://ccmixter.org/files/Robbero/43483) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:31 |
| 73 | Klaus | Skill\_Borrower | [ccMixter](https://ccmixter.org/files/Skill_Borrower/41751) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:37 |
| 74 | bloodonthesouthernstreets | Skye Jordan | [ccMixter](https://ccmixter.org/files/SkyeJordan/62938) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:05 |
| 75 | between worlds | smilingcynic | [ccMixter](https://ccmixter.org/files/smilingcynic/48420) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:33 |
| 76 | one track piano piece 2 | smilingcynic | [ccMixter](https://ccmixter.org/files/smilingcynic/36568) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:28 |
| 77 | piano impv 2 | smilingcynic | [ccMixter](https://ccmixter.org/files/smilingcynic/39618) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:59 |
| 78 | Si | smilingcynic | [ccMixter](https://ccmixter.org/files/smilingcynic/39598) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:14 |
| 79 | Reiswerk's Weather \(dubwise\) | Speck | [ccMixter](https://ccmixter.org/files/speck/50758) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:20 |
| 80 | Intergalactic Journey | spinmeister | [ccMixter](https://ccmixter.org/files/spinmeister/21067) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 5:59 |
| 81 | Moments in Space | spinmeister | [ccMixter](https://ccmixter.org/files/spinmeister/12093) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 4:44 |
| 82 | Moonrise | Stefan Kartenberg | [ccMixter](https://ccmixter.org/files/JeffSpeed68/57218) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:09 |
| 83 | Smokey Eyes | Stefan Kartenberg | [ccMixter](https://ccmixter.org/files/JeffSpeed68/56377) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:42 |
| 84 | Two Pianos | Stefan Kartenberg | [ccMixter](https://ccmixter.org/files/JeffSpeed68/57454) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:28 |
| 85 | 2011 Even | unreal\_dm | [ccMixter](https://ccmixter.org/files/unreal_dm/29561) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:25 |
| 86 | Eternal Loop of Glue - Instrumental | Wired Ant | [ccMixter](https://ccmixter.org/files/Wired_Ant/39945) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 3:23 |
| 87 | Rio sleeping \(Instrumental\) | Wired Ant | [ccMixter](https://ccmixter.org/files/Wired_Ant/38273) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 2:33 |

## Remezclas con material de terceros

- «Infinite Sorrows» (@nop): <https://ccmixter.org/files/blues_agent/17447>
- «Warm Ink» (\_ghost): <https://ccmixter.org/files/speck/36991>
- «Confederation Line» (Admiral Bob): <https://ccmixter.org/files/geoffpeters/59754>
- «High Above the Darkness \(My Star\)» (Admiral Bob): <https://ccmixter.org/files/SkyeJordan/62815>
- «Recovered Memory» (Admiral Bob): <https://ccmixter.org/files/doxent/48045>
- «The Broken» (Admiral Bob): <https://ccmixter.org/files/VJ_Memes/33269>
- «bluenotes» (airtone): <https://ccmixter.org/files/admiralbob77/64415>
- «bsides» (airtone): <https://ccmixter.org/files/KungFuFrijters/35722>, <https://ccmixter.org/files/KungFuFrijters/35745>
- «lostTrack» (airtone): <https://ccmixter.org/files/mwic/61255>
- «roboduck» (airtone): <https://ccmixter.org/files/duckett/12523>, <https://ccmixter.org/files/duckett/14269>
- «shimmer» (airtone): <https://ccmixter.org/files/SackJo22/64534>
- «spacedust» (airtone): <https://ccmixter.org/files/mwic/32718>
- «Improvisation On Friday...» (Alex): <https://ccmixter.org/files/The3amAssociation/14163>
- «Improvisation On Sunday...» (Alex): <https://ccmixter.org/files/The3amAssociation/14414>
- «Purple Nurple» (Alex): <https://ccmixter.org/files/go1dfish/25460>
- «The Parting Glass \(Instrumental\)» (Aussens@iter): <https://ccmixter.org/files/doxent/56347>
- «GOOD NIGHT» (Bocrew): <https://ccmixter.org/files/snowflake/31435>
- «Passing Through» (Bocrew): <https://ccmixter.org/files/djlang59/61786>
- «SUNBIRDS» (Bocrew): <https://ccmixter.org/files/4nsic/22923>
- «pieces of life» (cdk): <https://ccmixter.org/files/admiralbob77/16410>
- «ＭＩＬＬＥＮＮＩＡＬＳ» (cdk): <https://ccmixter.org/files/Bluemillenium/57104>
- «Down the Lighted Path» (Darkroom): <https://ccmixter.org/files/Klaus_Neumaier/12226>
- «Static» (Darkroom): <https://ccmixter.org/files/Cdala/19187>
- «Good Night» (Dub Alta Fidelidad): <https://ccmixter.org/files/doxent/47797>
- «Solstice Contemplation» (duckett): <https://ccmixter.org/files/Pitx/33759>, <https://ccmixter.org/files/donkeyhorsemule/34570>, <https://ccmixter.org/files/F_Fact/34625>
- «Alex's Remix» (go1dfish): <https://ccmixter.org/files/DoKashiteru/20945>
- «Homework» (gurdonark): <https://ccmixter.org/files/nickleus/28805>
- «Longing» (gurdonark): <https://ccmixter.org/files/Vidian/29716>, <https://ccmixter.org/files/Vidian/33272>
- «Lost in Memory» (gurdonark): <https://ccmixter.org/files/TheDICE/36018>, <https://ccmixter.org/files/TheDICE/37601>
- «Playground» (gurdonark): <https://ccmixter.org/files/kenrestivo/8484>, <https://ccmixter.org/files/Pitx/16712>
- «Sensitive» (gurdonark): <https://ccmixter.org/files/ondrosik/35357>
- «Statia» (gurdonark): <https://ccmixter.org/files/djlang59/12132>, <https://ccmixter.org/files/djlang59/12133>, <https://ccmixter.org/files/djlang59/13352>
- «Dream On This Side \(instrumental\)» (Ivan Chew): <https://ccmixter.org/files/cdk/8978>, <https://ccmixter.org/files/cdk/11675>, <https://ccmixter.org/files/cdk/14246>, <https://ccmixter.org/files/cdk/28350>, <https://ccmixter.org/files/cdk/34151>
- «3 pound universe» (Jeris): <https://ccmixter.org/files/doxent/41411>
- «Improvisation on a Beach Blanket» (Kirkoid): <https://ccmixter.org/files/AlexBeroza/17253>, <https://ccmixter.org/files/AlexBeroza/17376>
- «Shiro \(Kirkoid Mix\)» (Kirkoid): <https://ccmixter.org/files/hansatom/33396>
- «Space Bazooka» (Kirkoid): <https://ccmixter.org/files/doxent/42265>
- «Reflections in the Rain» (Mana Junkie): <https://ccmixter.org/files/gurdonark/33436>, <https://ccmixter.org/files/onlymeith/33867>
- «Quiet Hours» (onlymeith): <https://ccmixter.org/files/doxent/39616>
- «Quiet Rain» (onlymeith): <https://ccmixter.org/files/gurdonark/33436>
- «Tendency» (onlymeith): <https://ccmixter.org/files/speck/38674>
- «Truth?» (onlymeith): <https://ccmixter.org/files/tglancy/37678>
- «Bye Bye 2010» (Pitx): <https://ccmixter.org/files/SmoJos/29799>
- «Long Live Blind Joe» (Robbero): <https://ccmixter.org/files/Mr_Yesterday/43004>
- «Mountains \(Hip hop instrumental\)» (Robbero): <https://ccmixter.org/files/doxent/42760>
- «mysterious light bells» (Robbero): <https://ccmixter.org/files/nickleus/39792>
- «Sad Night» (Robbero): <https://ccmixter.org/files/Klaus_Neumaier/14316>
- «Spheres \(Hip Hop Instrumental\)» (Robbero): <https://ccmixter.org/files/doxent/43475>
- «Klaus» (Skill\_Borrower): <https://ccmixter.org/files/Klaus_Neumaier/6652>, <https://ccmixter.org/files/Klaus_Neumaier/6660>, <https://ccmixter.org/files/Klaus_Neumaier/6792>, <https://ccmixter.org/files/Klaus_Neumaier/7263>, <https://ccmixter.org/files/Klaus_Neumaier/7265>, <https://ccmixter.org/files/Klaus_Neumaier/7293>, <https://ccmixter.org/files/Klaus_Neumaier/7778>, <https://ccmixter.org/files/Klaus_Neumaier/10284>
- «Reiswerk's Weather \(dubwise\)» (Speck): <https://ccmixter.org/files/Reiswerk/50363>
- «Moments in Space» (spinmeister): <https://ccmixter.org/files/DJ_Rkod/11368>
- «Moonrise» (Stefan Kartenberg): <https://ccmixter.org/files/admiralbob77/57215>
- «Two Pianos» (Stefan Kartenberg): <https://ccmixter.org/files/admiralbob77/33244>
