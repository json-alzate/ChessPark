# Ejemplos de Flujos Git

## Crear y completar una feature

```bash
# 1. Crear rama
git checkout develop
git pull origin develop
git checkout -b feature/add-puzzle-hints

# 2. Trabajar y commitear
git add .
git commit -m "✨ feat(puzzles): add hint system for puzzle solver"

# 3. Mergear a develop
git checkout develop
git pull origin develop
git merge feature/add-puzzle-hints
git push origin develop
git branch -d feature/add-puzzle-hints
```

## Hotfix urgente en producción

```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-auth-token-expiry

# ... corrección ...
git add .
git commit -m "🚑️ hotfix: fix token expiry in authentication"

git checkout main
git merge hotfix/fix-auth-token-expiry
git push origin main

git checkout develop
git merge hotfix/fix-auth-token-expiry
git push origin develop

git branch -d hotfix/fix-auth-token-expiry
```

## Preparar release

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# Ajustes de versionado, changelog, etc.
git add .
git commit -m "🔖 release: prepare version 1.2.0"

git checkout main
git merge release/v1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin main --tags

git checkout develop
git merge release/v1.2.0
git push origin develop

git branch -d release/v1.2.0
```
