---
name: git-workflow
description: Gestiona operaciones git siguiendo GitFlow y la convención de commits del proyecto. Use when handling git operations, commits, branches, merges, or feature/bugfix/hotfix/release flows. References docs/GITFLOW.md.
---

# Git Workflow (ChessPark)

## Commit Format

Siempre seguir el formato definido en [docs/GITFLOW.md](docs/GITFLOW.md):

```
<emoji> <tipo>(<scope>): <descripción>
```

- **Emoji** al inicio (obligatorio)
- **Tipo** en inglés, presente
- **Scope** opcional: board, puzzles, chessColate, chessGrid, common, config
- **Descripción** clara y concisa

## Emojis Principales

| Emoji | Tipo | Uso |
|-------|------|-----|
| ✨ | feat | Nueva funcionalidad |
| 🐛 | fix | Corrección de bug |
| ⬆️ | upgrade | Upgrade de dependencias |
| ♻️ | refactor | Refactorización |
| 📝 | docs | Documentación |
| ✅ | test | Tests |
| 🔧 | config | Configuración |
| 🔀 | merge | Merge de ramas |

Ver tabla completa en [docs/GITFLOW.md](docs/GITFLOW.md).

## Flujos de Ramas

### Feature (desde develop)
```bash
git checkout develop && git pull origin develop
git checkout -b feature/nombre-feature
# ... trabajo ...
git add . && git commit -m "✨ feat(scope): descripción"
git checkout develop && git merge feature/nombre-feature
git push origin develop
git branch -d feature/nombre-feature
```

### Bugfix (desde develop)
```bash
git checkout develop && git pull origin develop
git checkout -b bugfix/nombre-bugfix
# ... trabajo ...
git add . && git commit -m "🐛 fix(scope): descripción"
git checkout develop && git merge bugfix/nombre-bugfix
git push origin develop
```

### Hotfix (desde main)
```bash
git checkout main && git pull origin main
git checkout -b hotfix/nombre-hotfix
# ... trabajo ...
git add . && git commit -m "🚑️ hotfix: descripción"
git checkout main && git merge hotfix/nombre-hotfix && git push origin main
git checkout develop && git merge hotfix/nombre-hotfix && git push origin develop
git branch -d hotfix/nombre-hotfix
```

### Release (desde develop)
```bash
git checkout develop && git pull origin develop
git checkout -b release/vX.Y.Z
# ... ajustes finales ...
git add . && git commit -m "🔖 release: preparar vX.Y.Z"
git checkout main && git merge release/vX.Y.Z && git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin main --tags
git checkout develop && git merge release/vX.Y.Z && git push origin develop
```

## Checklist Pre-Commit

- [ ] Mensaje sigue formato `<emoji> <tipo>(<scope>): <descripción>`
- [ ] Emoji corresponde al tipo de cambio
- [ ] Build pasa: `nx run-many -t build`
- [ ] Tests pasan (si aplica)
- [ ] Lint pasa (si aplica)
- [ ] Sin console.logs de debug
- [ ] Sin código comentado innecesario

## Scopes del Proyecto

- `board` — librería @chesspark/board
- `puzzles` — puzzles-provider
- `chessColate` — app chessColate
- `chessGrid` — app chessGrid
- `common` — common-utils
- `config` — configuración (nx, tsconfig, etc.)

## Referencia

Para la tabla completa de emojis y flujos detallados, ver [docs/GITFLOW.md](docs/GITFLOW.md). El comando [.cursor/commands/commit.md](.cursor/commands/commit.md) guía la generación del mensaje de commit.
