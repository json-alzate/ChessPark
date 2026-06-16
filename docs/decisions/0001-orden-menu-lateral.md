# 0001 - Orden del menú lateral

- Fecha: 2026-06-16
- Estado: Aceptada
- Área: Navegación / Information Architecture

## Contexto

El menú lateral izquierdo (`side-menu`) de ChessColate listaba sus opciones sin
un orden lógico: los mini-juegos de entrenamiento (Coordenadas, Recorrido del
caballo, Chess960) estaban intercalados con los planes de puzzles (Públicos,
Personalizados, Historial), y opciones administrativas como Ajustes y Donar
quedaban dispersas. El usuario no podía formar un modelo mental claro de la app
a partir del menú.

## Decisión

Reorganizar `menuOptions` en **cuatro grupos lógicos**, separados visualmente
con un `divider`:

1. **Inicio**
   - Home
2. **Planes de puzzles** (núcleo de la app — flujo descubrir → crear → revisar)
   - Planes públicos
   - Planes personalizados
   - Historial de planes
3. **Ejercicios de entrenamiento**
   - Coordenadas
   - Recorrido del caballo
   - Chess960
4. **App y cuenta**
   - Ajustes
   - Donar (solo en plataformas nativas)

Implementación: se añadió la propiedad opcional `divider?: boolean` a la
interfaz `MenuOption`. Marca el inicio de un grupo y el template renderiza un
separador encima de esa opción.

## Razón

- **Los planes de puzzles son el núcleo de la app**, por eso van inmediatamente
  después de Home, en la posición de mayor visibilidad.
- Dentro de los planes, el orden sigue el **flujo natural de uso**:
  descubrir (públicos) → crear (personalizados) → revisar (historial).
- Los **ejercicios sueltos** se agrupan entre sí para no competir con el
  contenido principal.
- **Ajustes y Donar** son administrativos/secundarios → al final, que es donde
  el usuario espera encontrarlos.
- Los separadores dan jerarquía visual sin necesidad de etiquetas de sección,
  manteniendo el menú limpio.

## Referencias

- `apps/chessColate/src/app/app.component.ts` — array `menuOptions` e interfaz `MenuOption`
- `apps/chessColate/src/app/app.component.html` — render del `@for` con `divider`
- `docs/STYLE_GUIDE.md` — sección "Navegación / Menú lateral"
