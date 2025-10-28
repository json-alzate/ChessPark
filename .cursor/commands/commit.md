Tu trabajo es generar un commit con un mensaje claro según todos los cambios realizados. al inicio del mensaje eligiras un emoji para adicionar y seguirás la siguiente convención y guía.

# 📘 Convención de Commits con Gitmoji

Esta guía define el uso estándar de **emojis Gitmoji** en los mensajes de commit para este proyecto. Usar emojis ayuda a comunicar de forma rápida e intuitiva el propósito del cambio.

> 📌 **Formato sugerido de commit:**  
> `:emoji: Tipo de cambio en lenguaje natural`  
> Ejemplo:  
> `🐛 Fix bug in service core`  
> `✨ Add login feature to mobile SDK`

---

## 🗂️ Tabla de Emojis y Significado

| Emoji | Código Gitmoji | Uso |
|-------|----------------|-----|
| 🎨 | `:art:` | Mejoras en el formato o estructura del código |
| ⚡️ | `:zap:` | Mejoras de rendimiento |
| 🔥 | `:fire:` | Eliminación de código o archivos |
| 🐛 | `:bug:` | Corrección de errores |
| 🚑️ | `:ambulance:` | Hotfix crítico |
| ✨ | `:sparkles:` | Nuevas funcionalidades |
| 📝 | `:memo:` | Documentación agregada o actualizada |
| 🚀 | `:rocket:` | Despliegue de versiones |
| 💄 | `:lipstick:` | Cambios en estilos o UI |
| 🎉 | `:tada:` | Inicio del proyecto |
| ✅ | `:white_check_mark:` | Agregar o actualizar tests |
| 🔒️ | `:lock:` | Corrección de problemas de seguridad |
| 🔐 | `:closed_lock_with_key:` | Agregado o actualización de secretos |
| 📦️ | `:package:` | Archivos compilados o paquetes |
| 🔖 | `:bookmark:` | Tags de versión/releases |
| 🚨 | `:rotating_light:` | Corrección de warnings |
| 🚧 | `:construction:` | Trabajo en progreso |
| 💚 | `:green_heart:` | Fix para builds en CI |
| ⬇️ | `:arrow_down:` | Downgrade de dependencias |
| ⬆️ | `:arrow_up:` | Upgrade de dependencias |
| 📌 | `:pushpin:` | Fijar versiones de dependencias |
| 👷 | `:construction_worker:` | Cambios en CI/CD |
| 📈 | `:chart_with_upwards_trend:` | Analítica o tracking |
| ♻️ | `:recycle:` | Refactorización |
| ➕ | `:heavy_plus_sign:` | Agregar dependencia |
| ➖ | `:heavy_minus_sign:` | Eliminar dependencia |
| 🔧 | `:wrench:` | Archivos de configuración |
| 🔨 | `:hammer:` | Scripts de desarrollo |
| 🌐 | `:globe_with_meridians:` | Internacionalización o localización |
| ✏️ | `:pencil2:` | Corrección de typos |
| 💩 | `:poop:` | Código de mala calidad temporal |
| ⏪️ | `:rewind:` | Revertir cambios |
| 🔀 | `:twisted_rightwards_arrows:` | Merge de ramas |
| 👽️ | `:alien:` | Cambios por APIs externas |
| 🚚 | `:truck:` | Mover o renombrar archivos |
| 📄 | `:page_facing_up:` | Licencias |
| 💥 | `:boom:` | Cambios que rompen compatibilidad |
| 🍱 | `:bento:` | Assets |
| ♿️ | `:wheelchair:` | Accesibilidad |
| 💡 | `:bulb:` | Comentarios en código |
| 💬 | `:speech_balloon:` | Literales o textos |
| 🗃️ | `:card_file_box:` | Cambios en base de datos |
| 🔊 | `:loud_sound:` | Logs agregados o actualizados |
| 🔇 | `:mute:` | Eliminación de logs |
| 👥 | `:busts_in_silhouette:` | Contribuyentes agregados/actualizados |
| 🚸 | `:children_crossing:` | Mejora de UX |
| 🏗️ | `:building_construction:` | Cambios arquitectónicos |
| 📱 | `:iphone:` | Diseño responsive |
| 🤡 | `:clown_face:` | Mock de código |
| 🥚 | `:egg:` | Easter eggs |
| 🙈 | `:see_no_evil:` | .gitignore |
| 📸 | `:camera_flash:` | Snapshots de test |
| ⚗️ | `:alembic:` | Experimentos |
| 🔍️ | `:mag:` | SEO |
| 🏷️ | `:label:` | Tipado |
| 🌱 | `:seedling:` | Seeds de datos |
| 🚩 | `:triangular_flag_on_post:` | Feature flags |
| 🥅 | `:goal_net:` | Manejo de errores |
| 💫 | `:dizzy:` | Animaciones y transiciones |
| 🗑️ | `:wastebasket:` | Código obsoleto |
| 🛂 | `:passport_control:` | Permisos/autorización |
| 🩹 | `:adhesive_bandage:` | Fix menor |
| 🧐 | `:monocle_face:` | Exploración de datos |
| ⚰️ | `:coffin:` | Código muerto eliminado |
| 🧪 | `:test_tube:` | Tests que fallan |
| 👔 | `:necktie:` | Lógica de negocio |
| 🩺 | `:stethoscope:` | Healthcheck |
| 🧱 | `:bricks:` | Infraestructura |
| 🧑‍💻 | `:technologist:` | Mejora en DX (developer experience) |
| 💸 | `:money_with_wings:` | Infraestructura financiera |
| 🧵 | `:thread:` | Concurrencia/multihilo |
| 🦺 | `:safety_vest:` | Validaciones |
| ✈️ | `:airplane:` | Soporte offline |

---

## ✅ Recomendaciones

- Siempre usar el emoji al inicio del mensaje.
- El mensaje debe estar en inglés y en presente (ej: `Add`, `Fix`, `Refactor`).
- En el cuerpo del commit (si aplica), agrega contexto o links a tareas.