# Pruebas de ChessColate

Las pruebas **no viven junto al código**: `tests/` es un espejo de `src/app/`, para
que al leer el código solo se vean archivos de código.

```
src/app/features/reminders/utils/reminder-time.util.ts
tests/unit/features/reminders/utils/reminder-time.util.spec.ts      ← espejo exacto
```

- **Una prueba por archivo fuente**, en la misma ruta relativa y con el mismo nombre
  más `.spec.ts`. Si un archivo fuente no tiene prueba, falta su espejo.
- Las E2E son un proyecto aparte: `apps/chessColate-e2e` (Playwright).
- Los datos y dobles que se comparten entre pruebas van en `tests/support/`.

## Reglas

1. **Imports con alias** (`@services/*`, `@features/*`, `@shared/*`, `@app/*`, `@tests/*` (para `tests/support`),
   `@chesspark/*`), nunca rutas relativas hacia `src/`.
2. **No se modifica código de `src/` para poder probarlo.** Si algo no se deja
   probar, se anota el motivo y se prueba lo que sí se pueda.
3. **Se prueba comportamiento, no implementación**: entradas y salidas, estados,
   eventos emitidos, llamadas a colaboradores que importan. No se prueban detalles
   privados ni se duplica la lógica del código dentro de la prueba.
4. **Una prueba que no puede fallar no sirve.** Cada `it` debe contener al menos
   una aserción que fallaría si el comportamiento se rompiera.
5. **Sin red, sin Firebase real, sin relojes reales**: se usan dobles (`jest.fn`,
   `jest.useFakeTimers`) y `TestBed` con proveedores falsos.
6. Nombres en español, como el resto del proyecto: `it('empieza mañana si la hora ya pasó', …)`.

## Cómo correrlas

```bash
npx nx test chessColate                                     # todas
npx nx test chessColate --testPathPattern=tests/unit/services/plans   # una carpeta
```
