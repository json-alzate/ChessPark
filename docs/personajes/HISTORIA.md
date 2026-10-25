# Historia, mapa y jugabilidad del Chess Runner con la manada

> La esencia del juego no cambia: se corre sobre las piezas del ejercicio, se salta, se resuelve y se avanza por la campaña de
> 20 capítulos ([CHESS_RUNNER_FLOW.md](../implementado/CHESS_RUNNER_FLOW.md)). Lo que se añade es la manada, una historia que la una,
> un mapa por zonas y más profundidad de juego.
>
> **Leyenda:** ✅ decidido por Jheison · 💡 propuesta, por confirmar · ❓ abierto.

## Lo que ya existe en el juego

El Chess Runner **ya cuenta una historia** (sin letreros, solo imágenes y globos con dibujitos; `features/chess-runner/story/`):
un perrito duerme junto al **frasco de galletas doradas** del reino, el **Rey de las Sombras** (la pieza negra del set del usuario,
teñida de violeta y con ojos rojos) se lo lleva, y el perrito lo persigue por seis mundos; en cada uno le corta el paso un
guardián, aprende el patrón y gana un poder. Al final recupera el frasco y amanece.
Ver [CHESS_RUNNER_FLOW.md](../implementado/CHESS_RUNNER_FLOW.md).

**Lo nuevo no parte de cero, evoluciona eso:** el robo del *frasco* pasa a ser el secuestro del *panadero* (el frasco puede seguir
siendo lo que el panadero tenía al ser llevado), y el perrito solo pasa a ser una manada.

## Premisa

- ✅ Un **panadero** vive con los perros y les hace las galletas. Le encanta el ajedrez: **cada vez que resuelve un problema se
  pone feliz y les hornea galletas**.
- ✅ Al panadero lo **secuestran**. Mientras se lo llevaban fue **tirando galletas** y quedaron regadas por todos los mundos:
  por eso hay galletas por todas partes (y por eso son la moneda del juego).
- ✅ Los perros salen a **buscarlo** siguiendo el rastro de galletas.
- 💡 **Quién lo secuestró:** el **Rey de las Sombras**, que ya es el villano del juego. Ver [El villano](#el-villano). Los seis jefes de zona (animales) son *jefes medios*: él es el final.
- ❓ Nombre del panadero.

## El villano

✅ Un villano a quien le molesta que el ajedrez sea divertido y lo quiere **serio y aburrido**.

💡 **Recomendación: no inventar uno nuevo, usar al Rey de las Sombras que ya existe.** Antes propuse un «Rey Tedio» sin haber
visto que el juego ya tenía su villano; son la misma idea:

- Ya es un **rey oscuro**, ya se lleva algo a quien los perros quieren, ya es el **último guardián** y está dibujado y probado.
- Su nombre ya cuenta lo que quieres: **las sombras** apagan la alegría y el color. Encaja con que el mundo se vaya oscureciendo
  según se acerca a él.
- Su motivo, nuevo: **odia que el panadero resuelva problemas con alegría** y reparta galletas. Se lo lleva para que el tablero
  vuelva a ser solemne y callado.
- Los jefes medios (los seis animales) serían **sus lugartenientes**, o animales a los que dejó sin alegría: así vencerlos puede
  ser también devolverles el ánimo.

Otras ideas descartadas (un motor de ajedrez frío, un exjugador amargado) no hace falta retomarlas salvo que quieras otro tono.

✅ **El mundo se va volviendo más tenebroso** a medida que se acerca al villano final (ver [Mapa](#mapa)).

❓ Confirmar que el villano es el Rey de las Sombras.

## La manada en la historia

| Personaje | Papel | Relación con los demás |
|---|---|---|
| Chocolate | ❓ | ❓ |
| Nannukk | ❓ | ❓ |

✅ **Los perros se rescatan en las zonas:** se empieza con Chocolate y los demás se van encontrando, atrapados o perdidos, a lo largo
del recorrido. Cada rescate suma un personaje (y su poder) a la manada.

✅ **En la zona final del Rey de las Sombras, todos los niveles se juegan con la manada completa.** Las seis zonas anteriores sirven
para rescatarlos.

💡 Hay **9 por rescatar** (Nannukk, Kiana, Romeo, Luna, Maryluna, Tony, Tormenta, Zack y la gatita) y **6 zonas donde rescatarlos**:
1 o 2 por zona (por ejemplo 2, 2, 2, 1, 1, 1), de modo que llegan los nueve al empezar la zona 7. Qué personaje va en qué zona se decide
con sus fichas. ❓ Si las zonas 5 y 6 ya se juegan con casi toda la manada, o si cada una solo con los rescatados hasta ahí.

✅ Chocolate entra como **Choco**. Ver [Chocolate](#chocolate).

### Chocolate

El chocolate es dañino para los perros, y hay dudas de si un personaje con ese nombre manda un mensaje malo.

✅ **Entra, y en el juego se llama «Choco»** (nombre corto, sin cambiar su sprite ni su paleta).

💡 Lo que sí hay que cuidar es lo que se **ve**, no el nombre: nada de perros comiendo chocolate.

### Las galletas y el chocolate

Hoy la **galleta del juego** (`COOKIE_ART` en `rendering/pixel-art.ts`) ya lleva «chispas de chocolate», y el **icono de la app**
(`assets/icons/icon-512x512.png`) ya es una galleta con forma de **tablero de ajedrez** en tonos chocolate y vainilla.

💡 Si las galletas siguen siendo el icono y la moneda, conviene que no contradigan la historia (galletas **para perros**):

- Las chispas oscuras son de **algarroba**, que sí es segura para los perros y parece chocolate. Se puede decir en una línea de la
  historia o del tutorial («galletas de algarroba»); y de paso enseña algo real.
- El **icono de la marca** puede quedar con chocolate: es para las personas, no para los perros.

✅ **El icono no cambia.** Las galletas que recogen los perros pasan a ser **la galleta del icono**: el tablero de ajedrez hecho
galleta, en chocolate (de algarroba) y vainilla.

💡 Cómo se vería en pixel art (probado en `docs/local/galleta-opciones.png`, no versionado):

| Opción | Tamaño | Cómo se lee |
|---|---|---|
| A. Plana | 10×10, 4×4 casillas | clara y limpia, incluso pequeña; parece algo más un tablero que una galleta |
| **B. Con grosor** (recomendada) | 10×10, 4×3 casillas + canto | el canto le da cuerpo de galleta y se parece al icono 3D |
| C. Grande | 12×12, 5×5 casillas | muy fiel, pero grande para la barra y para correr con la manada |

- 💡 La **galleta dorada** (la del frasco) sería la misma galleta en dorado y crema: la rara, de premio.
- 💡 Hoy la galleta es `COOKIE_ART` (9×9, redonda con chispas) en `rendering/pixel-art.ts`; cambiarla es pequeño y está probado
  (`pixel-art.spec.ts`), pero se usa en varios sitios (globo de la historia, barra, galleta suelta del camino), hay que revisarlos.

## Mapa

✅ **Un recorrido que conecta varias zonas muy distintas entre sí.** El mapa de Change
(`~/Documents/Change/Trabajo_Mapa/Map_color.png`) es **solo una referencia de la idea del camino**: ni su arte ni sus zonas se
usan. El mapa de Chess Runner se arma desde cero, en pixel art como los perros.

✅ **No se ve todo el mapa de una vez: se ve por zonas**, como en Change. Se muestra la zona en la que estás; las siguientes quedan
ocultas (niebla o nubes) hasta que se abren.

✅ **Cada zona es más tenebrosa que la anterior**, hasta llegar a la zona final, la del villano.

✅ **Siete zonas.** Las **seis primeras** las gobierna cada una el jefe medio de un animal de los planes por defecto de ChessColate. La
**séptima** es la del **Rey de las Sombras**, y en ella **todos los niveles son con la manada completa**. Los iconos de los planes son
estos seis, de más rápido a más lento:

| Plan de ChessColate | Animal | Zona |
|---|---|---|
| Bullet (1 min) | Ardilla | 1 |
| Blitz (3) | Conejo | 2 |
| Blitz+ (5) | Mono | 3 |
| Rápida (10) | Caballo | 4 |
| Rápida+ (20) | Elefante | 5 |
| Clásica (30) | Tortuga | 6 |

✅ Jheison nombró cinco y olvidó el **mono** (el sexto icono de los planes): entra.

💡 **El orden coincide con la dificultad:** va del plan más veloz al más pausado. La ardilla gobierna el territorio de los ejercicios
más fáciles y rápidos, y la tortuga el de los más profundos.

✅ **En cada territorio se trabajan varios temas tácticos**, empezando por los más fáciles y subiendo el nivel zona a zona.
❓ **Qué temas va en cada zona, y cuántos capítulos**: se decide más adelante. Hoy son 20 capítulos de un tema cada uno
(`CHAPTERS` en `runner-curriculum.ts`); con zonas y jefes habrá que reagruparlos.

### Los jefes medios

| Zona | Jefe | 💡 Territorio posible | 💡 Rasgo que podría dar su carácter al nivel |
|---|---|---|---|
| 1 | Ardilla | bosque de árboles altos y nogales | muy rápida: poco tiempo, obstáculos que llegan seguidos |
| 2 | Conejo | praderas y madrigueras | saltarina: huecos y cuevas con saltos encadenados |
| 3 | Mono | selva y ruinas | trepa y balancea: obstáculos que se mueven en el aire |
| 4 | Caballo | llanura y cañón | salta en **L**, como la pieza: patrones de obstáculos en forma de L |
| 5 | Elefante | sabana seca | obstáculos enormes y pesados que piden saltar con tiempo |
| 6 | Tortuga | costa, pantano y laguna | lenta y firme: tramos pausados pero muy trampeados |

Son ideas para empezar a hablar: el territorio y el carácter de cada jefe se afinan en su propia ficha.

✅ **Zona 7: la guarida del Rey de las Sombras** (el villano final, si se confirma). Es la más oscura y no tiene jefe medio: cada
nivel es un tramo hacia el rey, y **siempre corre la manada completa** (ver [Jugabilidad](#jugabilidad)).

### Puntos del mapa

✅ Cada punto de parada (**checkpoint**) es **una tanda de ejercicios**, no uno solo: por ejemplo, el de mate en 1 es una rutina de varios
ejercicios que hay que pasar para llegar al siguiente. Hoy es el **bloque** de un capítulo (`BLOCK_SIZE` = 5 ejercicios del mismo patrón).
✅ Algunos checkpoints piden un **ELO mínimo** para pasar. Ver [ELO mínimo](#elo-mínimo-en-los-checkpoints).

Cuántos puntos habría que dibujar (con el reparto de temas de abajo, un checkpoint por patrón):

| Zona | Checkpoints de patrón | + rescate | + campamento | Puntos en el cuadro |
|---|---|---|---|---|
| 1 Ardilla | 6 (el último, el jefe) | 1 | 1 | 8 |
| 2 Conejo | 6 | 1 | 1 | 8 |
| 3 Mono | 6 | 1 | 1 | 8 |
| 4 Caballo | 6 | 1 | 1 | 8 |
| 5 Elefante | 5 | 1 | 1 | 7 |
| 6 Tortuga | 5 | 1 | 1 | 7 |
| 7 Rey de las Sombras | 6 «puertas» de repaso + `mateIn4` + `mateIn5` + el Rey = 9 | — | — | 9 |
| **Total** | **43 checkpoints** | 6 | 6 | **≈ 55 puntos** |

💡 43 checkpoints × 5 ejercicios = **215 ejercicios** en una vuelta (hoy son 20 × 5 = 100). Un **nodo de rescate** puede liberar a más de un
perro, y el **campamento** es el descanso con repaso mixto (opcional).

### ELO mínimo en los checkpoints

💡 **Me parece buena idea, con cuidado.** El ELO del perrito no se «cultiva»: converge hacia el nivel real de quien juega (K = 32 los
30 primeros ejercicios y 24 después; resolver uno igual a tu ELO da +12). Un ELO mínimo es, en el fondo, **un filtro de nivel**, y puede
dejar atascado a alguien que no mejora. Para que ayude y no frustre:

- **Pocos y bien elegidos:** solo en los **jefes** (y la entrada a la zona 7), no en cada checkpoint. Por ejemplo 3 o 4 en todo el mapa.
- **Visibles:** un candado con el número en el mapa y una barra con lo que falta.
- **Con salida:** que haya algo que hacer para subir (el campamento, la repetición de checkpoints) y no una pared.
- **Mejor como examen que como número** (opción que recomiendo). Dos formas de poner el mismo candado, con el jefe de la zona 3 a **ELO 1000**:
  - *Como número:* «para entrar necesitas ELO 1000 o más». Hay que mirar el ELO del perrito, que sube y baja con cada ejercicio: quien
    lo tiene en 980 ve un candado sin saber por qué, y un mal rato lo puede hacer bajar justo antes de pasar.
  - *Como examen (mi propuesta):* el jefe **es una tanda de ejercicios de ELO 1000** (por ejemplo 5, y se pasa con 4). Si los resuelves,
    pasas; si no, vuelves al campamento a practicar y lo reintentas. **No se mira el ELO del perrito**: se comprueba directamente que sabes
    resolver ejercicios de ese nivel. Quien ya sabe pasa de golpe, y no hay un número «resbaladizo» que bloquee.
- **Alcanzable para todos:** el perrito parte de «ELO del usuario − 300» (entre 600 y 1500). Los mínimos tienen que dejar el final
  al alcance de quien empieza en 600, aunque tarde.

❓ ¿Qué checkpoints tienen candado y de qué ELO? Se decide cuando se cierre el reparto de temas.

### El mapa de papel (minimapa)

✅ La app muestra **la zona en la que estás** (varios cuadros, no un mapa enorme), pero además hay un **mapa de papel**, como el que
llevarían los perros siguiendo el rastro, para que se vea **en qué punto del viaje van**.

💡 Cómo lo plantearía:

- **El mapa es un papel viejo doblado** (pixel art) con **el camino de las siete zonas** como una ruta que serpentea de una a otra.
- **El rastro son las galletas del panadero:** el camino se marca con galletas-tablero (las mismas del icono); las ya recogidas se ven
  llenas y las que faltan, apagadas. Así el mapa cuenta la historia y a la vez es la barra de progreso.
- **Cada zona es una parada con la cara de su jefe** (ardilla, conejo, mono, caballo, elefante, tortuga) y la última, la silueta del Rey de
  las Sombras. Las zonas que **aún no se han abierto salen en silueta o con un «?»**, de modo que sigue sin verse todo el mapa de una vez.
- **Un marcador con la huella de la manada** (o la cara del líder) indica dónde están. Dentro de la zona actual se ven sus 7 o 8 puntos como
  puntitos de la ruta.
- **Se va oscureciendo:** el papel se ve cada vez más gris y quemado hacia el final, igual que las zonas.
- **Dónde se ve:** un botón en la pantalla de la zona lo abre (como sacar el mapa del bolsillo), y una **tira pequeña siempre visible**
  (siete tramos y un punto) da el progreso de un vistazo sin abrir nada.
- Son un **asset por zona** (el cuadro grande de cada una) **más el mapa de papel**; no hay una imagen gigante.

### Cómo se dibuja

- 💡 **La oscuridad es un nivel aparte del ambiente** (de 0 a 5): baja la saturación, añade viñeta y cambia el decorado (árboles
  muertos, grietas, piezas grises) en cualquier territorio. Así no hay que reordenar los 6 mundos de ambiente de hoy (`day`, `sunset`,
  `night`, `mist`, `dawn`, `storm`).
- 💡 **Cada zona es un cuadro propio**, con su camino y sus nodos (capítulos). Entre zonas hay un punto de paso que se abre al
  vencer al jefe (un puente, una compuerta, una barca…).
- 💡 **Un nodo especial por zona es el rescate** del perro (o los perros) de esa zona.
- 💡 El arte sale de scripts en `tools/stream-assets/` (un módulo por zona, determinista y con `--check`), y las posiciones de los
  nodos van en un archivo de datos aparte.
- ❓ Tamaño del cuadro de cada zona: los lienzos del runner usan una escala entera (`round(ancho / 220)`), así que cada zona
  se dibujaría de unos **220 px lógicos de ancho** y el alto que haga falta, con scroll vertical si es larga.

## Temas, ELO y repaso

Lo que el juego ya hace (`features/chess-runner/campaign/`): el perrito tiene **su propio ELO** (parte del del usuario y sube o baja con cada
ejercicio), cada capítulo pide ejercicios de **un solo patrón** con la dificultad subiendo dentro del bloque (de −200 a +140 sobre su
ELO), se guarda cuánto acierta en **cada patrón** (`mastery`), tras cada capítulo hay **2 ejercicios de repaso del patrón más flojo**, y al
vencer al último guardián empieza otra **ronda** con los mismos patrones, más difíciles.

Con eso, el problema «un tema no es igual a un ELO bajo que a uno alto» ya está medio resuelto: **la zona dice el *qué*, el ELO dice el
*cuánto***, y no van atados. 💡 Propuesta para completarlo:

1. **Zona = qué patrones se aprenden; el ELO no se fija por zona.** Los ejercicios siempre salen del ELO *actual* del perrito, así que un
   mismo patrón se vuelve a encontrar más difícil si el perrito ha subido.
2. **Cada patrón se ve dos veces: debut y reencuentro.** El debut es en su zona, con su lección. El reencuentro llega una o dos zonas
   después, dentro del **jefe** (que mezcla los patrones de su zona con uno antiguo, «lo que el jefe te recuerda»). Es un currículo en
   espiral: el repaso queda dentro del mapa.
3. **Repaso en tres niveles:**
   - *Tras cada capítulo* (ya existe): 2 ejercicios del patrón más flojo.
   - *Campamento al final de cada zona* (nuevo): un nodo de descanso de la manada con ~5 ejercicios **mezclados de todos los patrones ya
     vistos**, elegidos por lo flojos que están y por **cuánto hace que no se ven** (`lastSeen` ya lo guarda), siempre al ELO de ahora.
   - *Rondas* (ya existe): al derrotar al Rey de las Sombras, el mapa vuelve a empezar en modo difícil.
4. **Un ELO por patrón (fase 2, opcional).** Hoy un solo ELO sirve para todos, pero uno puede ser fuerte en horquillas y flojo en
   clavadas. Se guardaría un **ELO por patrón** (parte del general y se mueve solo con ese patrón); los ejercicios de un patrón se piden
   a *su* ELO. Es lo que de verdad contesta a «¿es lo mismo este tema con otro ELO?». Pide cambiar el formato de lo guardado
   (`RunnerCampaign` pasaría a la versión 3, con migración).
5. **Quien ya sabe, no empieza de cero.** Un jugador de ELO alto aburriría la zona 1. 💡 Un **desafío del jefe** permite saltarse la
   zona: si vence a su jefe en el primer intento (mezcla de sus patrones al ELO de ahora), pasa a la siguiente.

### Reparto de temas por zona (borrador)

Hay **37 patrones** en el catálogo (14 «Temas» + 9 «Avanzado» + 14 «Mates»); el comodín `mate` no se usa como capítulo. Los 20 de hoy se
conservan **en su mismo orden** y se les suman 16 más, repartidos por dificultad (propuesta mía, a ajustar):

| Zona | Jefe | Patrones (en orden) |
|---|---|---|
| 1 | Ardilla | hangingPiece, mateIn1, fork, pin, *advancedPawn*, *exposedKing* |
| 2 | Conejo | skewer, backRankMate, discoveredAttack, capturingDefender, *attackingF2F7*, *kingsideAttack* |
| 3 | Mono | deflection, attraction, doubleCheck, trappedPiece, *sacrifice*, *queensideAttack* |
| 4 | Caballo | xRayAttack, arabianMate, anastasiaMate, *clearance*, *interference*, *doubleBishopMate* |
| 5 | Elefante | intermezzo, bodenMate, hookMate, *dovetailMate*, *defensiveMove* |
| 6 | Tortuga | smotheredMate, mateIn2, *mateIn3*, *quietMove*, *zugzwang* |
| 7 | Rey de las Sombras | **el gran repaso** (patrones de las zonas 1 a 6) y, de patrones nuevos, *mateIn4* y *mateIn5* |

(En cursiva, los nuevos: cada uno pide su **lección** y su traducción, como los 20 actuales.) Son 5 o 6 por zona en las seis primeras; el jefe de cada una usaría
el último patrón o una mezcla. **La zona 7 no enseña casi nada nuevo: es el examen.** 💡 Se podría plantear como un tramo por cada
zona anterior (una «puerta» por animal, con una mezcla de sus patrones al ELO de ahora), y al final el Rey con los mates largos.

❓ Cuántos capítulos y patrones por zona al final, y si se hace solo la fase 1 (zonas, jefes y campamento) o también el ELO por patrón.

## Jugabilidad

Lo que ya existe y se mantiene: salto sobre las piezas del ejercicio, 3 corazones, 3 ejercicios fallidos, galletas, poderes por
patrón, récord de distancia y ELO propio de la campaña.

✅ **Salto en manada, al estilo Zombie Tsunami:** a veces corren **todos los perros juntos** y un toque los hace saltar a todos.

💡 Cómo podría funcionar (a decidir):
- **En la zona 7 (Rey de las Sombras), todos los niveles son en manada completa** (✅ decidido). Antes, **el grupo crece** con cada
  rescate: solo con Choco al empezar, y en modo manada cuando ya hay varios (y en los jefes).
- **El líder marca el salto**; los demás lo siguen en fila con un pequeño retraso, de menor a mayor talla para que se vean todos.
- **Chocar cuesta un perro, no solo un corazón:** el perro golpeado se queda atrás y **vuelve al resolver el ejercicio**. La
  manada completa es la «vida».
- **Cada perro aporta su poder** mientras corre con el grupo (los poderes de hoy son del perrito: se repartirían por personaje).
- **Hitbox por talla:** un perro XL como Nannukk es más fácil de golpear; uno pequeño es ágil pero frágil.
- ❓ **Cuántos sprites caben a la vez:** son hasta **10 personajes** (9 rescatados más Choco) en un lienzo de ~220 px lógicos de ancho. No
  caben todos en fila: se puede mostrar al líder y a unos 4 o 5 más, y el resto como un contador («×10») o agrupado en «racimos».
- ❓ Cómo convive la manada con el **ejercicio de ajedrez** que se resuelve al final de la carrera (hoy: correr primero, resolver
  después).

## Cambios que esto pide en el código

Se completa al decidirlo. Tocará `features/chess-runner/` (mapa, campaña por zonas, selección y manada, poderes por personaje,
armario) y `tools/stream-assets/` (un módulo por personaje y las zonas del mapa).
