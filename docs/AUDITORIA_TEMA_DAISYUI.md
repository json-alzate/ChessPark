# Auditoría de Cumplimiento del Tema DaisyUI (Halloween)

Este documento lista los lugares de la app **ChessColate** donde **NO** se siguen las
variables del tema de DaisyUI, es decir, donde hay colores/estilos **fijos (hardcodeados)**
que se quedarían igual si se cambiara el tema `halloween` por otro tema de DaisyUI,
mientras el resto de la UI sí se adaptaría.

> Ver también la [Guía de Estilos](STYLE_GUIDE.md) para la convención de colores correcta.

## ¿Qué cuenta como "compatible con el tema"?

**Sí siguen el tema** (correcto): clases/variables semánticas de DaisyUI:
`primary`, `secondary`, `accent`, `neutral`, `base-100/200/300`, `base-content`,
`info`, `success`, `warning`, `error` y sus variantes `-content`.

- En Tailwind: `bg-primary`, `text-base-content`, `border-base-300`, …
- En CSS: `hsl(var(--bc))`, `hsl(var(--p))`, `hsl(var(--wa))`, …

**No siguen el tema** (lo que hay que corregir): hex (`#ffffff`), `rgb/rgba/hsl` literales,
colores con nombre (`white`, `black`, `red`), y clases fijas de Tailwind que no son
semánticas de DaisyUI (`bg-white`, `text-black`, `text-gray-500`, …).

---

## 🔴 Críticos (rompen el tema de forma visible)

### Botón de login (Google)
**Archivo:** `apps/chessColate/src/app/shared/components/login/login.component.html:22`
```
bg-white text-black border-[#e5e5e5]
→ bg-base-100 text-base-content border-base-300
```

### Página Coordinates
**Archivo:** `apps/chessColate/src/app/pages/coordinates/coordinates.page.scss`
- L17: `color: #ffffff;` → `color: hsl(var(--bc));` (equivalente a `text-base-content`)
- L93 / L96: `rgba(255, 215, 0, 0.5)` y `rgba(255, 215, 0, 0.8)` (oro, glow del badge récord)
  → `hsl(var(--wa))` (warning)

**Archivo:** `apps/chessColate/src/app/pages/coordinates/coordinates.page.ts:514-520`
```ts
confettiColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0']
['#000000', '#1a1a1a', '#333333', '#4d4d4d']
```
→ Mapear a la paleta DaisyUI (`hsl(var(--wa))`, `hsl(var(--su))`, …).

### Confetti (segunda implementación duplicada)
**Archivo:** `apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts:293`
```ts
const confettiColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
```
→ Idéntico al de coordinates. Conviene extraer a una utilidad compartida que use variables DaisyUI.

### Gráficas (Chart.js)
**Archivo:** `apps/chessColate/src/app/pages/puzzles/components/plan-chart/plan-chart.component.ts`
- L58: `color: '#bf811c',` → `color: 'hsl(var(--wa))'`
- L61: `color: 'white',` → `color: 'hsl(var(--bc))'`
- L148-149, L171-172, L194-195, L217-218:
```ts
backgroundColor: 'rgba(47, 223, 117, 0.2)', borderColor: 'rgba(41, 196, 103, 0.2)'  // success
backgroundColor: 'rgba(255, 73, 97, 0.2)',  borderColor: 'rgba(224, 64, 85, 0.2)'   // error
```
→ `hsl(var(--su) / 0.2)` para barras de éxito y `hsl(var(--er) / 0.2)` para error.

### Training
**Archivo:** `apps/chessColate/src/app/pages/puzzles/containers/training/training.component.html:225`
```
style="color: #bf811c;"   → text-warning
```

### Navbar
**Archivo:** `apps/chessColate/src/app/shared/components/navbar/navbar.component.html:13`
```
text-gray-500   → text-base-content/60
```
> Nota: en L65 `style="color: hsl(var(--er));"` **sí es compatible** ✓.

---

## 🟡 Medios (sombras con negro fijo)

Usan `rgba(0,0,0,…)` en `box-shadow`. Funcionan en cualquier tema pero no son
"theme-aware". **Recomendación: dejarlas como están** (las sombras suelen ser iguales
entre temas).

- `apps/chessColate/src/app/shared/components/navbar/navbar.component.scss:11`
- `apps/chessColate/src/app/shared/components/donation-modal/donation-modal.component.scss:16,65`
- `apps/chessColate/src/app/pages/coordinates/coordinates.page.scss:83`
- `apps/chessColate/src/app/pages/coordinates/components/game-results-modal/game-results-modal.component.scss:9`
- `apps/chessColate/src/app/pages/coordinates/components/settings-side-menu/settings-side-menu.component.scss:12,22`

---

## 🟢 Bajo (marcadores del tablero)

**Archivo:** `apps/chessColate/src/global.scss:52-168`

Flechas y círculos del tablero usan colores con nombre/hex (`green`, `yellow`, `red`,
`#7974ff`, `#46b0e0`, …). Son marcadores **funcionales** de la librería `cm-chessboard`
(verde = correcto, rojo = error), no parte del "tema" visual de la app.
**Recomendación: dejarlos como están**, salvo que se quieran mapear a `--su` / `--er` / `--in` / `--ac`.

---

## Resumen

| Prioridad | Cantidad | Acción sugerida |
|-----------|----------|-----------------|
| 🔴 Críticos | 7 zonas | Corregir |
| 🟡 Medios (sombras) | 5 archivos | Dejar como están |
| 🟢 Bajo (tablero) | 1 sección | Dejar como están |

**Ofensores más comunes:**
1. Hex hardcodeados (`#ffffff`, `#bf811c`, `#e5e5e5`) y colores de confetti.
2. Clases fijas de Tailwind (`bg-white`, `text-black`, `text-gray-500`).
3. Colores de Chart.js en archivos `.ts`.

**Zonas menos compatibles con el tema:** página *Coordinates*, *Login/Auth* y las
*visualizaciones/charts*.

**Cómo verificar:** cambiar temporalmente el tema de DaisyUI a otro (p. ej. `light` o
`dracula`) y observar qué elementos NO cambian de color — esos son los hardcodeados.
