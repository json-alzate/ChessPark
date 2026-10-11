# Comando — /chesscolate:probar (recorrer la app en vivo y dejar evidencia)

# Rol

Manejas un navegador real contra ChessColate corriendo en local para verificar que un flujo
**funciona de verdad** y dejar capturas numeradas como evidencia.

Es la otra mitad de las pruebas. La suite E2E (`apps/chessColate-e2e`) corre con la red cortada y
datos fijos: dice si algo **cambió** respecto a la captura de referencia. Tú verificas cómo
**se ve y se comporta ahora**, con los puzzles, Firebase y APIs de verdad, y generas evidencia que
una persona pueda mirar (antes y después de un cambio, un bug, una pantalla nueva).

# Argumentos

$ARGUMENTS

Puede venir un flujo (`entrenar una rutina Blitz`), una pantalla (`/streak`) o nada.

---

# 1. Pregunta antes de arrancar

**Nunca arranques sin confirmar.** Esto levanta un servidor, abre un navegador y gasta contexto.
Usa **AskUserQuestion** para cerrar:

1. **Qué recorrer** — el flujo o las pantallas, y qué se espera que pase.
2. **Servidor** — `devctl` (recomendado: recompila al editar, URL con HTTPS por Tailscale para
   probar en el celular) o la build estática de la E2E (puerto 4310, sin recompilar).
3. **Sesión** — invitado (por defecto) o con sesión iniciada. Con sesión, las credenciales las
   da quien lo pide, **en el prompt**: no se escriben en ningún archivo.
4. **Capturas** — solo diagnóstico (más barato) o también evidencia para compartir, y el nombre
   de la carpeta (`docs/local/<nombre>/`).

Si falta algo, pregúntalo. No lo adivines.

---

# 2. La economía de señales

Las tres señales no cuestan igual y la más barata es la que más sirve:

| Señal | Costo | Para qué |
|---|---|---|
| `browser_network_requests` | **bajo** (texto) | el diagnóstico real: qué se pidió (puzzles del CDN, Firebase, chess.com/lichess) y qué volvió |
| `browser_snapshot` | medio (texto) | navegar, ubicar controles, leer el estado de la pantalla |
| `browser_take_screenshot` | sacarla es barato, **analizarla es caro** (imagen) | evidencia para personas |

1. **Diagnostica con texto.** Red y snapshot.
2. **Sacar una captura no es analizarla.** Saca las que hagan falta como evidencia y analiza solo
   las que respondan una pregunta visual (avisa antes).
3. Lo que se guarda no se ve en una captura: míralo en `localStorage`/IndexedDB con
   `browser_evaluate` (`chessColate_plans_history`, `chessColate_streak_record`, …).

---

# 3. Levanta el entorno

**Con devctl** (sigue las preferencias del usuario: nada de `nohup ng serve` a mano):

```bash
~/.local/bin/devctl up chesscolate      # compila primero; puede tardar. Déjalo en segundo plano
~/.local/bin/devctl status              # ¿ya está arriba?
~/.local/bin/devctl logs chesscolate -n 40
```

La app responde en `http://localhost:4301` (y en la URL de Tailscale que muestra `devctl list`).
**Espera a que responda** antes de navegar. Al terminar: `~/.local/bin/devctl down chesscolate`.

**Con la build estática de la E2E** (sin watch, la misma que usan las pruebas):

```bash
E2E_PORT=4310 node apps/chessColate-e2e/support/serve.mjs   # compila si falta dist/
```

Necesita `apps/chessColate/src/environments/private/keys.ts` (ignorado por git).

---

# 4. Recorre el flujo

El viewport ya viene como iPhone 15 (`.mcp.json`): la app es móvil, no la pruebes en escritorio.

- El **onboarding** sale la primera vez: ciérralo, o recórrelo si es lo que se prueba.
- En modo invitado no hay sesión: rutinas propias/públicas y sincronización con Firestore
  piden iniciar sesión. Las funciones nativas (recordatorios, compras, calificar la app) no
  funcionan en el navegador: es lo esperado, anótalo y sigue.
- **Mira la red en cada paso que escribe o descarga**: puzzles (`cdn.jsdelivr.net`), Firestore,
  APIs de chess.com / lichess. ¿Se pidió? ¿Con qué status? ¿La pantalla refleja lo que volvió?
- El tablero se mueve con clics sobre las casillas (`rect[data-square]`).

---

# 5. Evidencia

```
docs/local/<nombre>/
├── README.md              ← el reporte
└── evidencia/
    ├── 01-home-inicial.png
    ├── 02-rutina-presentacion.png
    └── NN-descripcion.png   ← numeradas en el orden del recorrido
```

`docs/local/` está en `.gitignore`: la evidencia no va al repo; si hace falta compartirla, se
sube aparte. Numera en el orden del recorrido, no por tema.

Para comparar **antes y después** de un cambio: corre el mismo recorrido en las dos ramas y
guarda en carpetas distintas (`<nombre>-antes`, `<nombre>-despues`).

---

# 6. El reporte y el triaje

En `docs/local/<nombre>/README.md`: fecha, rama y commit, servidor usado, sesión (invitado o no),
qué se recorrió y los hallazgos.

**La pregunta que lo define: ¿es la pantalla o es el dato?**

| Hallazgo | Va a |
|---|---|
| La pantalla se ve o se comporta mal y el dato llegó bien | bug de la app: se arregla aquí |
| El dato llegó mal, incompleto o no llegó (CDN, Firestore, API externa) | fuente de datos: anótalo con la petición y el status |
| Funciona pero está mal pensado | producto |
| Es algo que la E2E debió detectar | añade un caso a `apps/chessColate-e2e/specs/` |

Los hallazgos que no se corrigen en el momento se añaden a `docs/HALLAZGOS_PRUEBAS.md` con su
marca de verificación (✅ comprobado por ti, 🧪 reproducido, ❔ solo observado).

---

# 7. Cierra

- Baja el servidor (`devctl down chesscolate`).
- Di en una línea qué encontraste y dónde quedó cada cosa.
- Si no encontraste nada, dilo igual: que un flujo pase con datos reales es información, y es
  justo lo que la suite E2E (red cortada) no puede afirmar.
