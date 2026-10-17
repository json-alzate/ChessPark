# Flujo de la Reflexión de partidas

En el reproductor, al ver **una partida propia** (la que se abre desde Análisis), el usuario anota **hasta 2 cosas
que hizo bien** y **hasta 3 que quiere mejorar**. Cada una es un **tag**: se elige entre sugerencias o se crea
al momento con un nombre corto. Al ser tags y no texto libre, después se pueden contar y cruzar (qué aparece más
en las derrotas, qué mejora con el tiempo).

Código en `apps/chessColate/src/app/features/game-reflection/`. Hace falta sesión: sin ella la tarjeta explica
que hay que iniciarla, trae un botón **Iniciar sesión** que abre el modal de login (`LoginComponent`, igual que en
el resto de la app) y no lee ni escribe nada. Al entrar, la tarjeta se renueva sola: escucha
`GameReflectionService.uid$` (el uid del perfil) y recarga cuando cambia.

---

## Qué ve el usuario

Una tarjeta **«Mi reflexión»** debajo del tablero del reproductor, con dos listas (**Lo mejor que hice**, tope 2, y
**A mejorar**, tope 3). Cada lista muestra lo elegido como etiquetas que se quitan al tocarlas y, mientras quepan
más, un campo para buscar. Al escribir aparecen las sugerencias que coinciden (sin importar mayúsculas ni
tildes); si lo escrito no existe, sale **«Crear "…"»**. Enter crea el tag o elige la primera sugerencia.
**Guarda al tocar**, sin botón.

No aparece en las partidas del catálogo de campeones ni en el modo TV.

## El identificador de la partida

La reflexión se guarda con la **clave de la partida en su plataforma**, no con nada generado en la app:

| Plataforma | Qué se usa | Clave |
|---|---|---|
| lichess | el `id` de 8 caracteres | `lichess:q7ZvsdUF` |
| chess.com | el `uuid` de la partida (su `url` si faltara) | `chesscom:7f3c2a1e-…` |

Los normalizadores (`libs/*-provider/src/lib/normalize.ts`) ya lo guardan en `ChessGame.id`; `gameKeyOf` solo le
antepone la plataforma (para que no choquen) y cambia las `/` (un id de documento no las admite). Como es el de
la plataforma, **borrar la descarga y volver a bajarla da la misma clave**, y lo anotado reaparece. No se usa el
nombre de usuario ni el índice en la lista (que cambian).

## Cómo se guarda

Firestore, como subcolecciones del perfil (`Users/{uid}`), por `GameReflectionRepository`:

```
Users/{uid}/gameReflections/{gameKey}   una por partida
Users/{uid}/gameTags/{tagId}            los tags que creó el usuario
```

```ts
GameReflection { gameKey, platform, playedAt, outcome: 'win'|'draw'|'loss', best: string[], improve: string[], updatedAt }
GameTag        { id: 'u_a8f3k2', label, createdAt, archived? }
```

- **Se guarda el id del tag, nunca el texto.** Renombrar un tag, o cambiar el idioma de la app, no parte las
  estadísticas.
- **Dos tipos de tag.** Los **del sistema** (`SYSTEM_TAG_KEYS`: `tactics`, `endgames`, `dynamism`…) se guardan por
  clave y su texto sale de `GAME_REFLECTION.systemTags.*` en las traducciones. Los **propios** llevan el prefijo
  `u_`, son solo del usuario y **no se traducen**: se muestran como los escribió.
- `platform`, `playedAt` y `outcome` van copiados para cruzar estadísticas sin volver a descargar la partida.
- Con las dos listas vacías el documento se **borra**; no se guardan reflexiones vacías.
- Un tag no puede estar en las dos listas de una misma partida (`addTagToSelection`), y al escribir no se
  ofrece lo ya elegido.
- Los nombres de tag duplicados no se crean: `findTagByLabel` compara sin mayúsculas ni tildes contra los
  propios y los del sistema, y elige el existente.

## Capas

```
GamesViewerPage ──► GameReflectionComponent (containers/)   estado de la tarjeta, auto-guardado
                         │            └─► TagPickerComponent (components/)   una lista: solo pinta y avisa
                         ▼
                 GameReflectionService          sesión (uid), caché de tags, crear tag, guardar/borrar
                         ▼
                 GameReflectionRepository ──► Firestore
utils/game-reflection.util.ts: clave, validación, selección con topes, sugerencias, resumen por tag (puras)
config/game-reflection.config.ts: topes (2 y 3), largo máximo del tag (20), prefijo `u_`, tags del sistema
```

`GamesService.openOwnGames` conserva la `ChessGame` de cada fila (`getOwnGame(index)`): el visor la necesita para
saber plataforma e id. Si falla un guardado la tarjeta vuelve a lo anterior y avisa.

## Reglas de Firestore

El repositorio **no versiona las reglas de seguridad**; hay que permitir a cada usuario leer y escribir solo lo
suyo:

```
match /Users/{uid}/gameReflections/{doc} { allow read, write: if request.auth.uid == uid; }
match /Users/{uid}/gameTags/{doc}        { allow read, write: if request.auth.uid == uid; }
```

## Pendiente (a propósito)

- **Pantalla de estadísticas.** `summarizeTags(reflexiones, 'best' | 'improve')` ya cuenta cada tag y reparte sus
  resultados, y `GameReflectionService.getAllReflections()` trae los datos; falta pintarlo (p. ej. en Análisis).
- **Renombrar, archivar o borrar tags propios** (el modelo ya tiene `archived`).
- **Agrupar tags en categorías.**
