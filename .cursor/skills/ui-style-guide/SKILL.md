---
name: ui-style-guide
description: Construye y valida la interfaz gráfica de ChessColate según docs/STYLE_GUIDE.md. Usar al crear o modificar páginas, componentes o templates en apps/chessColate, o cuando el usuario pida revisar/validar la UI contra la guía de estilos.
---

# UI Style Guide - Construir y Validar Interfaz

La fuente de verdad es `docs/STYLE_GUIDE.md` en la raíz del repo. Consultarla al construir UI nueva o al validar existente.

## Cuándo usar este skill

- Crear o modificar páginas, componentes o templates en ChessColate.
- El usuario pide "validar la interfaz", "revisar contra la guía de estilos" o "que cumpla el style guide".
- Revisar PRs o cambios que toquen HTML/templates de la app.

## Construir UI nueva

1. **Leer** la sección relevante de `docs/STYLE_GUIDE.md` (estructura de páginas, tipografía, componentes, etc.).
2. **Estructura base** en páginas:
   - `ion-content [fullscreen]="true"` → contenedor con `class="main-container" data-theme="halloween"`.
   - Navbar `app-navbar` cuando corresponda.
   - Contenido en `div.container.mx-auto.px-4.py-6`.
3. **Tipografía**: H2 página `text-2xl font-bold mb-4`, H3 sección `text-xl font-semibold mb-2`, H4 `text-lg font-bold mb-1`, H6 etiquetas `text-sm text-base-content/70`, números ELO `text-4xl font-bold` con color `#bf811c`.
4. **Componentes**: Usar DaisyUI (btn, card, badge, collapse, tabs) e Ionic (ion-content, ion-footer) como en la guía.
5. **Responsive**: Usar breakpoints Tailwind (sm/md/lg/xl) y clases `md:hidden` / `hidden md:block` cuando haga falta.

## Validar UI existente

Recorrer el **Checklist de implementación** (ver guía) y reportar cumplimiento o incumplimientos:

```
Validación Style Guide:
- [ ] data-theme="halloween" en contenedor principal
- [ ] Estructura base: ion-content + main-container
- [ ] Navbar presente si aplica
- [ ] Títulos: text-2xl principal, jerarquía H3/H4/H6
- [ ] Color ELO #bf811c en valores de ELO
- [ ] Componentes DaisyUI correctos (btn-*, card bg-base-100, etc.)
- [ ] Estados de carga (skeleton o loading-spinner)
- [ ] Responsive (breakpoints, md:hidden/hidden md:block)
- [ ] Espaciado consistente (space-y-6, gap-4, etc.)
```

Para cada ítem: indicar ✅ o ❌ y, si falla, la corrección concreta (clase o fragmento a cambiar).

## Resumen rápido (no sustituye la guía)

| Área | Regla clave |
|------|-------------|
| Tema | `data-theme="halloween"` en main-container |
| Página | ion-content → main-container → container mx-auto px-4 py-6 |
| Título página | `<h2 class="text-2xl font-bold mb-4">` |
| ELO | `#bf811c` en estilo o en texto; h1 `text-4xl font-bold` |
| Botones | btn btn-primary, btn-ghost, btn-sm btn-soft btn-info según caso |
| Cards | card bg-base-100 shadow-sm, card-body |
| Footer móvil | ion-footer class="md:hidden" con btn en ion-toolbar |

## Referencia completa

Para ejemplos de código, variantes de botones, collapse, tabs, badges y responsive: ver `docs/STYLE_GUIDE.md` en la raíz del proyecto.
