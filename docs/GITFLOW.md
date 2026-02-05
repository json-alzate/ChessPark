# Convención de GitFlow y Commits

Este documento describe la convención de GitFlow y commits que debemos seguir en este proyecto.

## 📋 Tabla de Contenidos

- [GitFlow](#gitflow)
- [Convención de Commits](#convención-de-commits)
- [Estructura de Ramas](#estructura-de-ramas)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Ejemplos](#ejemplos)

## 🌳 GitFlow

GitFlow es un modelo de ramificación de Git que define un conjunto estricto de ramas diseñadas para proporcionar un framework robusto para gestionar proyectos más grandes.

## 📝 Convención de Commits

Todos los commits deben seguir el formato:

```
<emoji> <tipo>: <descripción>

[descripción opcional más detallada]

[referencias a issues opcionales]
```

### Formato

```
<emoji> <tipo>(<scope>): <descripción corta>

<descripción detallada opcional>

<referencias a issues opcionales>
```

### Tipos de Commits

| Emoji | Código | Tipo | Descripción |
|-------|--------|------|-------------|
| 🎨 | `:art:` | `art` | Mejoras en el formato o estructura del código |
| ⚡️ | `:zap:` | `perf` | Mejoras de rendimiento |
| 🔥 | `:fire:` | `remove` | Eliminación de código o archivos |
| 🐛 | `:bug:` | `fix` | Corrección de errores |
| 🚑️ | `:ambulance:` | `hotfix` | Hotfix crítico |
| ✨ | `:sparkles:` | `feat` | Nuevas funcionalidades |
| 📝 | `:memo:` | `docs` | Documentación agregada o actualizada |
| 🚀 | `:rocket:` | `deploy` | Despliegue de versiones |
| 💄 | `:lipstick:` | `style` | Cambios en estilos o UI |
| 🎉 | `:tada:` | `init` | Inicio del proyecto |
| ✅ | `:white_check_mark:` | `test` | Agregar o actualizar tests |
| 🔒️ | `:lock:` | `security` | Corrección de problemas de seguridad |
| 🔐 | `:closed_lock_with_key:` | `secrets` | Agregado o actualización de secretos |
| 📦️ | `:package:` | `build` | Archivos compilados o paquetes |
| 🔖 | `:bookmark:` | `release` | Tags de versión/releases |
| 🚨 | `:rotating_light:` | `lint` | Corrección de warnings |
| 🚧 | `:construction:` | `wip` | Trabajo en progreso |
| 💚 | `:green_heart:` | `ci` | Fix para builds en CI |
| ⬇️ | `:arrow_down:` | `downgrade` | Downgrade de dependencias |
| ⬆️ | `:arrow_up:` | `upgrade` | Upgrade de dependencias |
| 📌 | `:pushpin:` | `pin` | Fijar versiones de dependencias |
| 👷 | `:construction_worker:` | `ci` | Cambios en CI/CD |
| 📈 | `:chart_with_upwards_trend:` | `analytics` | Analítica o tracking |
| ♻️ | `:recycle:` | `refactor` | Refactorización |
| ➕ | `:heavy_plus_sign:` | `deps` | Agregar dependencia |
| ➖ | `:heavy_minus_sign:` | `deps` | Eliminar dependencia |
| 🔧 | `:wrench:` | `config` | Archivos de configuración |
| 🔨 | `:hammer:` | `chore` | Scripts de desarrollo |
| 🌐 | `:globe_with_meridians:` | `i18n` | Internacionalización o localización |
| ✏️ | `:pencil2:` | `typo` | Corrección de typos |
| 💩 | `:poop:` | `hack` | Código de mala calidad temporal |
| ⏪️ | `:rewind:` | `revert` | Revertir cambios |
| 🔀 | `:twisted_rightwards_arrows:` | `merge` | Merge de ramas |
| 👽️ | `:alien:` | `api` | Cambios por APIs externas |
| 🚚 | `:truck:` | `move` | Mover o renombrar archivos |
| 📄 | `:page_facing_up:` | `license` | Licencias |
| 💥 | `:boom:` | `breaking` | Cambios que rompen compatibilidad |
| 🍱 | `:bento:` | `assets` | Assets |
| ♿️ | `:wheelchair:` | `a11y` | Accesibilidad |
| 💡 | `:bulb:` | `comment` | Comentarios en código |
| 💬 | `:speech_balloon:` | `text` | Literales o textos |
| 🗃️ | `:card_file_box:` | `db` | Cambios en base de datos |
| 🔊 | `:loud_sound:` | `log` | Logs agregados o actualizados |
| 🔇 | `:mute:` | `log` | Eliminación de logs |
| 👥 | `:busts_in_silhouette:` | `contrib` | Contribuyentes agregados/actualizados |
| 🚸 | `:children_crossing:` | `ux` | Mejora de UX |
| 🏗️ | `:building_construction:` | `arch` | Cambios arquitectónicos |
| 📱 | `:iphone:` | `responsive` | Diseño responsive |
| 🤡 | `:clown_face:` | `mock` | Mock de código |
| 🥚 | `:egg:` | `easter-egg` | Easter eggs |
| 🙈 | `:see_no_evil:` | `gitignore` | .gitignore |
| 📸 | `:camera_flash:` | `snapshot` | Snapshots de test |
| ⚗️ | `:alembic:` | `experiment` | Experimentos |
| 🔍️ | `:mag:` | `seo` | SEO |
| 🏷️ | `:label:` | `types` | Tipado |
| 🌱 | `:seedling:` | `seed` | Seeds de datos |
| 🚩 | `:triangular_flag_on_post:` | `feature-flag` | Feature flags |
| 🥅 | `:goal_net:` | `error-handling` | Manejo de errores |
| 💫 | `:dizzy:` | `animation` | Animaciones y transiciones |
| 🗑️ | `:wastebasket:` | `deprecate` | Código obsoleto |
| 🛂 | `:passport_control:` | `auth` | Permisos/autorización |
| 🩹 | `:adhesive_bandage:` | `patch` | Fix menor |
| 🧐 | `:monocle_face:` | `data` | Exploración de datos |
| ⚰️ | `:coffin:` | `remove` | Código muerto eliminado |
| 🧪 | `:test_tube:` | `test` | Tests que fallan |
| 👔 | `:necktie:` | `business` | Lógica de negocio |
| 🩺 | `:stethoscope:` | `healthcheck` | Healthcheck |
| 🧱 | `:bricks:` | `infra` | Infraestructura |
| 🧑‍💻 | `:technologist:` | `dx` | Mejora en DX (developer experience) |
| 💸 | `:money_with_wings:` | `sponsor` | Infraestructura financiera |
| 🧵 | `:thread:` | `concurrency` | Concurrencia/multihilo |
| 🦺 | `:safety_vest:` | `validation` | Validaciones |
| ✈️ | `:airplane:` | `offline` | Soporte offline |

### Scope (Opcional)

El scope indica el área del proyecto afectada. Ejemplos:
- `board`: Cambios en la librería de board
- `puzzles`: Cambios en puzzles-provider
- `chessColate`: Cambios en la app chessColate
- `chessGrid`: Cambios en la app chessGrid
- `common`: Cambios en utilidades comunes
- `config`: Cambios en configuración

## 🌿 Estructura de Ramas

### Ramas Principales

- **`main`** / **`master`**: Código en producción. Solo se actualiza mediante merges desde `develop` o `hotfix/*`.
- **`develop`**: Rama de desarrollo principal. Todas las features se integran aquí.

### Ramas de Soporte

- **`feature/*`**: Nuevas funcionalidades
  - Ejemplo: `feature/add-puzzle-solver`
  - Se crea desde: `develop`
  - Se mergea a: `develop`
  
- **`bugfix/*`**: Corrección de bugs en desarrollo
  - Ejemplo: `bugfix/fix-board-rendering`
  - Se crea desde: `develop`
  - Se mergea a: `develop`
  
- **`hotfix/*`**: Correcciones urgentes en producción
  - Ejemplo: `hotfix/fix-critical-security-issue`
  - Se crea desde: `main`
  - Se mergea a: `main` y `develop`
  
- **`release/*`**: Preparación de releases
  - Ejemplo: `release/v1.2.0`
  - Se crea desde: `develop`
  - Se mergea a: `main` y `develop`

## 🔄 Flujo de Trabajo

### 1. Iniciar una Nueva Feature

```bash
# Asegúrate de estar en develop y actualizado
git checkout develop
git pull origin develop

# Crea y cambia a la nueva rama de feature
git checkout -b feature/nombre-de-la-feature

# Trabaja en tu feature y haz commits
git add .
git commit -m "✨ feat(board): agregar validación de movimientos"
```

### 2. Completar una Feature

```bash
# Asegúrate de que todos los cambios estén commiteados
git add .
git commit -m "✨ feat(board): completar implementación de validación"

# Vuelve a develop y actualiza
git checkout develop
git pull origin develop

# Mergea tu feature
git merge feature/nombre-de-la-feature

# Elimina la rama local (opcional)
git branch -d feature/nombre-de-la-feature

# Push a develop
git push origin develop
```

### 3. Crear un Hotfix

```bash
# Crea el hotfix desde main
git checkout main
git pull origin main
git checkout -b hotfix/nombre-del-hotfix

# Haz los cambios y commitea
git add .
git commit -m "🚑️ hotfix: corregir error crítico en autenticación"

# Mergea a main
git checkout main
git merge hotfix/nombre-del-hotfix
git push origin main

# También mergea a develop
git checkout develop
git merge hotfix/nombre-del-hotfix
git push origin develop

# Elimina la rama
git branch -d hotfix/nombre-del-hotfix
```

### 4. Crear un Release

```bash
# Crea la rama de release desde develop
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# Haz ajustes finales (versionado, changelog, etc.)
git add .
git commit -m "🔖 release: preparar versión 1.2.0"

# Mergea a main
git checkout main
git merge release/v1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin main --tags

# También mergea a develop
git checkout develop
git merge release/v1.2.0
git push origin develop

# Elimina la rama
git branch -d release/v1.2.0
```

## 📚 Ejemplos

### Ejemplos de Commits Correctos

```bash
# Nueva funcionalidad
✨ feat(board): agregar componente de solución de puzzles

# Corrección de bug
🐛 fix(puzzles): corregir cálculo de dificultad

# Mejora de rendimiento
⚡️ perf(board): optimizar renderizado del tablero

# Refactorización
♻️ refactor(common): simplificar utilidades de validación

# Documentación
📝 docs: actualizar README con instrucciones de instalación

# Estilos
💄 style(chessColate): mejorar diseño del menú principal

# Tests
✅ test(puzzles): agregar tests para provider de puzzles

# Configuración
🔧 config: actualizar configuración de ESLint

# Dependencias
⬆️ deps: actualizar Angular a versión 18

# Hotfix crítico
🚑️ hotfix: corregir vulnerabilidad de seguridad en autenticación

# Cambios que rompen compatibilidad
💥 breaking(board): cambiar API de eventos del tablero
```

### Ejemplos de Commits Incorrectos

```bash
# ❌ Sin emoji
feat: agregar nueva funcionalidad

# ❌ Emoji incorrecto
🎨 fix: corregir bug

# ❌ Descripción muy vaga
✨ feat: cambios

# ❌ Sin tipo
✨ agregar funcionalidad
```

## ✅ Checklist Antes de Hacer Commit

- [ ] El mensaje sigue el formato: `<emoji> <tipo>(<scope>): <descripción>`
- [ ] El emoji corresponde al tipo de cambio
- [ ] La descripción es clara y concisa
- [ ] El scope es relevante (si se usa)
- [ ] El código compila sin errores
- [ ] Los tests pasan (si aplica)
- [ ] No hay código comentado innecesario
- [ ] Se han eliminado console.logs de debug (o se han convertido a logs apropiados)

## 🔗 Referencias

- [GitFlow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [Gitmoji](https://gitmoji.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Nota**: Esta convención debe ser seguida por todos los desarrolladores del proyecto para mantener un historial de commits limpio y comprensible.
