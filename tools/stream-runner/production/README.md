# Directo 24/7 en producción

El directo de producción **no corre desde el repo**: vive en una carpeta autónoma al lado, `ChessPark-stream/`,
y solo se actualiza cuando se pide. Así, cambiar de rama, compilar o hacer `npm install` en `ChessPark` no puede
tumbar la transmisión (el runner relee su app, su música y su código en cada reinicio, cada 4 h o tras una caída).

```
Projects/
  ChessPark/            el repo de desarrollo (aquí están estos scripts)
  ChessPark-stream/     producción, autónoma
    app -> releases/<fecha>     versión de la app en uso (enlace; se cambia al actualizar)
    releases/                   las últimas 3 versiones (para volver atrás)
    runner/                     run-stream.mjs, start-live.mjs, lib/, node_modules/ (puppeteer-core), music/, .chrome-profile/
    VERSION                     qué se compiló, de qué rama/commit y cuándo
```

## Antes de la primera vez (lo hace una persona)
1. **Clave del canal de producción en el llavero** (nunca en el repo ni en un chat; pide la clave sin mostrarla):
   ```bash
   security add-generic-password -a "$USER" -s chesscolate-youtube-prod -w
   ```
   Se crea con la **clave de emisión reutilizable** del directo de YouTube del canal de producción.
2. **Inicio de sesión automático** del Mac (Ajustes del Sistema → Usuarios y grupos). Sin él, tras un reinicio el
   directo no vuelve hasta que alguien inicie sesión.
3. Crear la transmisión en YouTube Studio con **esa** clave y la descripción de `music/DESCRIPCION_MUSICA.txt`.

## Comandos (desde la raíz del repo)

| Qué | Comando |
|---|---|
| Crear o actualizar producción desde `main` (lo recomendado) | `bash tools/stream-runner/production/deploy-stream.sh --app-ref main` |
| Lo mismo desde otra rama o commit | `… deploy-stream.sh --app-ref <rama>` |
| Probar lo que hay en tu carpeta de trabajo (**no para producción**) | `… deploy-stream.sh` |
| Copiar sin reiniciar el directo | `… deploy-stream.sh --app-ref main --no-restart` |
| Volver a la versión anterior de la app | `… deploy-stream.sh --rollback` |
| Instalar el arranque automático (**empieza a emitir**) | `bash tools/stream-runner/production/install-launchagent.sh` |
| Detener el directo y quitar el arranque automático | `bash tools/stream-runner/production/uninstall-launchagent.sh` |
| **Ensayo sin YouTube** (HLS temporal, no usa el llavero) | `node ../ChessPark-stream/runner/start-live.mjs --target=hls` |

`--app-ref` compila la app en una **copia limpia** de esa rama (un `git worktree` temporal): no usa tu rama actual ni
tus cambios sin commitear. Sin `--app-ref` se compila tu carpeta de trabajo y se avisa si hay cambios sin commitear.
El runner (`run-stream.mjs`, `start-live.mjs`) y la música salen siempre de tu carpeta de trabajo.

Actualizar **reinicia el directo** (corte de unos segundos) si el LaunchAgent está cargado. Con `--no-restart` la
versión nueva entra en el siguiente reinicio (como mucho, 4 h).

## Operación
- **Registro:** `~/Library/Logs/chesscolate-live/stream.log` (rota a 5 MB, conserva 2). `launchd.err.log` solo trae
  los fallos del propio Node.
- **Estado:** `launchctl print gui/$(id -u)/com.chesscolate.live-stream | head -20`
- **Qué hay en producción:** `cat ../ChessPark-stream/VERSION`
- **Si no hay clave en el llavero** el arranque falla con un mensaje claro (código 3) y `launchd` lo reintenta cada 30 s.
- **Puerto:** la app se sirve en `127.0.0.1:4320` (solo local).

## Riesgos que se asumen
- Actualizar o reiniciar corta el directo unos segundos.
- Si se actualiza con una versión rota de la app, el directo emite esa versión hasta volver atrás (`--rollback`).
- **La clave es visible en `ps`**: el runner la recibe por variable de entorno, pero `ffmpeg` la lleva como último argumento (la URL de destino RTMP). Cualquier proceso de tu usuario en este Mac puede leerla mientras emite. En un Mac de un solo usuario es un riesgo bajo; no se ha resuelto. Si alguna vez se filtra, se borra la clave en YouTube Studio (papelera junto a la clave) y se crea otra.
- `node` se fija con la ruta absoluta al instalar el LaunchAgent: si cambias de versión de Node con nvm y desaparece
  esa ruta, hay que reinstalarlo.
