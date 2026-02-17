# Referencia Git Workflow

## Tabla de Emojis (resumen)

| Emoji | Tipo | Descripción |
|-------|------|-------------|
| ✨ | feat | Nuevas funcionalidades |
| 🐛 | fix | Corrección de errores |
| ⬆️ | upgrade | Upgrade de dependencias |
| ⬇️ | downgrade | Downgrade de dependencias |
| ♻️ | refactor | Refactorización |
| 📝 | docs | Documentación |
| ✅ | test | Tests |
| 🔧 | config | Configuración |
| 🔀 | merge | Merge de ramas |
| 🚑️ | hotfix | Hotfix crítico |
| 🔖 | release | Tags/Releases |
| 💄 | style | Estilos/UI |
| ⚡️ | perf | Rendimiento |

## Estructura de Ramas

- **main** — Producción
- **develop** — Desarrollo principal
- **feature/*** — Features (desde develop)
- **bugfix/*** — Bugs (desde develop)
- **hotfix/*** — Urgentes (desde main)
- **release/*** — Releases (desde develop)

## Ejemplos de Mensajes Correctos

```
✨ feat(board): add puzzle solution component
🐛 fix(puzzles): correct difficulty calculation
⬆️ upgrade(angular): migrate to Angular 20
♻️ refactor(common): simplify validation utils
```

## Ejemplos Incorrectos

```
feat: add feature          # Sin emoji
🎨 fix: correct bug        # Emoji incorrecto
✨ agregar funcionalidad   # Sin tipo en inglés
```
