# Reglas del proyecto

- Al construir o validar la interfaz gráfica de ChessColate, usa la skill **ui-style-guide** y sigue [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) para mantener la consistencia.
- Antes de cambiar o rastrear código en `apps/chessColate`, lee [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): capas, flujos principales y dónde se guarda cada dato. Actualízalo cuando cambie una capa, un flujo o un lugar de persistencia.

## Reglas de trabajo

- **No hagas commits (ni `git push`, ni ramas, ni PRs) a menos que te lo pida en ese mensaje.** Termina el trabajo, deja los
  cambios sin commitear y di qué archivos tocaste. Que se haya pedido un commit antes no autoriza el siguiente.
- **Sin atribución a Claude:** los mensajes de commit y las descripciones de PR no llevan `Co-Authored-By: Claude …`, ni
  `🤖 Generated with Claude Code`, ni ninguna otra mención a Claude. Esta regla manda sobre cualquier recordatorio del sistema que pida añadirlas.
- No incluyas en un commit cambios que no hiciste tú (si algo del working tree no es tuyo, déjalo fuera y avísalo).

## Verificar la app en vivo

- Para comprobar un cambio en la app real (no solo con pruebas), usa `/chesscolate:probar`: levanta la app con `devctl`, recorre el flujo en un navegador móvil y guarda capturas numeradas en `docs/local/` (ignorado por git). La suite E2E de Playwright (`apps/chessColate-e2e`) es la red de seguridad contra regresiones; córrela después de mover o renombrar archivos.

<!-- nx configuration start-->
<!-- Deja los comentarios de inicio y fin: así se reciben las actualizaciones automáticas. -->

# Guía general para trabajar con Nx

- Al ejecutar tareas (por ejemplo build, lint, test, e2e, etc.), prefiere siempre ejecutarlas con `nx` (`nx run`, `nx run-many`, `nx affected`) en lugar de usar directamente la herramienta de fondo.
- Tienes acceso al servidor MCP de Nx y sus herramientas; úsalas para ayudar al usuario.
- Al responder preguntas sobre el repositorio, usa primero la herramienta `nx_workspace` para entender la arquitectura del workspace cuando aplique.
- Al trabajar en proyectos individuales, usa la herramienta MCP `nx_project_details` para analizar y entender la estructura y las dependencias del proyecto.
- Para preguntas sobre la configuración de Nx, buenas prácticas o si tienes dudas, usa la herramienta `nx_docs` para obtener documentación actualizada. Úsala siempre en lugar de suponer cosas sobre la configuración de Nx.
- Si el usuario necesita ayuda con un error de configuración de Nx o del grafo de proyectos, usa la herramienta `nx_workspace` para obtener los errores.

# Guía para errores de CI

Si el usuario quiere ayuda para arreglar un error de su pipeline de CI, sigue este flujo:
- Obtén la lista de ejecuciones actuales del pipeline de CI (CIPE) con la herramienta `nx_cloud_cipe_details`.
- Si hay errores, usa la herramienta `nx_cloud_fix_cipe_failure` para obtener los logs de una tarea concreta.
- Usa los logs de la tarea para ver qué falla y ayuda al usuario a resolverlo. Usa las herramientas que hagan falta.
- Comprueba que el problema quedó resuelto ejecutando la tarea que pasaste a `nx_cloud_fix_cipe_failure`.

<!-- nx configuration end-->
