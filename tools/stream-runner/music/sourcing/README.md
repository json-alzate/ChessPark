# Cómo se obtuvo la música

Scripts que escribió un agente de IA el 2026-10-12 para buscar y descargar las pistas de
`../manifest.json`. Se guardan **como registro de procedencia**, no como herramienta mantenida: las rutas
apuntan a `/private/tmp/claude-501/music/` y no se han vuelto a ejecutar. Se revisó que solo contacten
ccMixter, Creative Commons, Wikimedia Commons, chriszabriskie.com, Incompetech e Internet Archive, sin
credenciales ni nada destructivo.

Un detalle a conocer: ccMixter devuelve 403 al enlace de descarga si no llega un `Referer` de la página de la
pista; `ccm_fetch.py` manda el `Referer` de esa misma página pública, como haría un navegador al pulsar
"download". No se usó login ni captcha.
