# Componentes de Coordenadas de Ajedrez

Este directorio contiene los componentes auxiliares que han sido extraídos del componente principal `coordinates.page.ts` para mejorar la organización, mantenibilidad y reutilización del código.

## Componentes Disponibles

### 1. `game-results-modal` - Modal de Resultados del Juego
- **Propósito**: Muestra los resultados finales del juego, incluyendo puntaje, aciertos, errores y precisión
- **Características**: 
  - Maneja la celebración de nuevos récords
  - Muestra estadísticas detalladas del juego
  - Responsive y accesible

### 2. `scoreboard` - Tabla de Puntajes
- **Propósito**: Muestra los mejores puntajes del usuario y estadísticas generales
- **Características**:
  - Lista de top 5 puntajes
  - Estadísticas por color (blancas/negras)
  - Contador total de rondas jugadas

### 3. `king-avatar` - Avatar del Rey
- **Propósito**: Muestra el avatar del rey del color con el que se está jugando
- **Características**:
  - Tamaños configurables (sm, md, lg)
  - Muestra información del récord actual
  - Animaciones y efectos visuales

### 4. `game-stats` - Estadísticas del Juego Actual
- **Propósito**: Muestra estadísticas en tiempo real durante el juego
- **Características**:
  - Contador de aciertos y errores
  - Cálculo de precisión
  - Solo visible durante el juego activo

### 5. `timer` - Contador de Tiempo
- **Propósito**: Muestra el tiempo restante y la barra de progreso
- **Características**:
  - Barra de progreso visual
  - Cambios de color según el tiempo restante
  - Formato de tiempo legible

### 6. `board-orientation-controls` - Controles de Orientación
- **Propósito**: Permite cambiar la orientación del tablero
- **Características**:
  - Botones para orientación blanca, negra o aleatoria
  - Solo visible cuando no se está jugando
  - Diseño responsive con DaisyUI

## Beneficios de la Refactorización

### ✅ **Mantenibilidad**
- Cada componente tiene una responsabilidad específica
- Código más fácil de entender y modificar
- Menor acoplamiento entre funcionalidades

### ✅ **Reutilización**
- Los componentes pueden ser reutilizados en otras páginas
- Lógica encapsulada y reutilizable
- Fácil testing individual de cada componente

### ✅ **Organización**
- Estructura de archivos más clara
- Separación de responsabilidades
- Código más legible y mantenible

### ✅ **Testing**
- Cada componente puede ser testeado independientemente
- Mocks más simples y específicos
- Mejor cobertura de código

## Uso de los Componentes

Todos los componentes son **standalone** y se importan directamente en el componente principal:

```typescript
import {
  GameResultsModalComponent,
  ScoreboardComponent,
  KingAvatarComponent,
  GameStatsComponent,
  TimerComponent,
  BoardOrientationControlsComponent,
} from './components';
```

## Estructura de Archivos

```
components/
├── game-results-modal/
│   ├── game-results-modal.component.ts
│   ├── game-results-modal.component.html
│   └── game-results-modal.component.scss
├── scoreboard/
│   ├── scoreboard.component.ts
│   ├── scoreboard.component.html
│   └── scoreboard.component.scss
├── king-avatar/
│   ├── king-avatar.component.ts
│   ├── king-avatar.component.html
│   └── king-avatar.component.scss
├── game-stats/
│   ├── game-stats.component.ts
│   ├── game-stats.component.html
│   └── game-stats.component.scss
├── timer/
│   ├── timer.component.ts
│   ├── timer.component.html
│   └── timer.component.scss
├── board-orientation-controls/
│   ├── board-orientation-controls.component.ts
│   ├── board-orientation-controls.component.html
│   └── board-orientation-controls.component.scss
├── index.ts
└── README.md
```

## Próximos Pasos

1. **Testing**: Crear tests unitarios para cada componente
2. **Storybook**: Documentar los componentes con Storybook
3. **Optimización**: Implementar OnPush change detection donde sea apropiado
4. **Accesibilidad**: Mejorar la accesibilidad de cada componente
5. **Internacionalización**: Preparar para múltiples idiomas
