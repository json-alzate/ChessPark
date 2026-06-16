# Registro de Decisiones (ADR)

Este directorio contiene los **Architecture/Design Decision Records** del proyecto:
decisiones relevantes de diseño, arquitectura, UX o producto junto con el
**contexto** y la **razón** que las motivaron.

## ¿Por qué existe esto?

El código dice **qué** hacemos; estos documentos dicen **por qué** lo hicimos.
Cuando alguien (persona o IA) quiera cambiar algo, debería leer primero la
decisión asociada para no deshacer un acuerdo previo sin saberlo.

## ¿Cuándo crear un ADR?

Crea uno cuando tomes una decisión que:

- afecte la experiencia o la estructura de la app (navegación, flujos, IA),
- elija entre varias alternativas razonables (librería, patrón, tema),
- sea difícil de inferir leyendo el código,
- probablemente se cuestione en el futuro.

No hace falta para cambios triviales o puramente mecánicos.

## Cómo crear uno

1. Copia la plantilla de abajo en un archivo nuevo.
2. Numéralo de forma incremental: `NNNN-titulo-corto.md` (ej. `0002-...`).
3. Mantenlo corto: contexto → decisión → razón.
4. Añádelo al índice de este README.

## Estados posibles

- **Propuesta** — en discusión, aún no aplicada.
- **Aceptada** — vigente.
- **Reemplazada por NNNN** — sustituida por otra decisión (enlázala).
- **Obsoleta** — ya no aplica.

## Plantilla

```markdown
# NNNN - Título de la decisión

- Fecha: AAAA-MM-DD
- Estado: Aceptada
- Área: (Navegación / Arquitectura / UX / Producto / ...)

## Contexto
Qué problema o situación motivó la decisión.

## Decisión
Qué se decidió hacer, de forma concreta.

## Razón
Por qué esta opción y no otra. Trade-offs considerados.

## Referencias
- archivos / PRs / enlaces relevantes
```

## Índice

| #    | Decisión                                          | Estado   | Fecha      |
|------|---------------------------------------------------|----------|------------|
| 0001 | [Orden del menú lateral](0001-orden-menu-lateral.md) | Aceptada | 2026-06-16 |
