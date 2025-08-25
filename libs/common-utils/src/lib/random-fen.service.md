# RandomFENService

Servicio Angular para generar posiciones FEN (Forsyth-Edwards Notation) aleatorias de ajedrez **REALISTAS**.

## Características

- ✅ Genera posiciones FEN válidas y legales
- ✅ **RESPETO TOTAL a las reglas del ajedrez** - Máximo 1 dama, 2 torres, 2 caballos, 2 alfiles, 8 peones por color
- ✅ Coloca reyes en posiciones no adyacentes
- ✅ Configurable para incluir/excluir tipos de piezas
- ✅ Límite configurable de piezas
- ✅ Validación de FEN
- ✅ Generación de múltiples posiciones
- ✅ **Nuevo**: Generación de posiciones realistas
- ✅ **Nuevo**: Generación de finales de partida
- ✅ **Nuevo**: Generación de medio juego
- ✅ **Nuevo**: Análisis y validación de posiciones

## Uso Básico

```typescript
import { RandomFENService } from '@chesspark/common-utils';

@Component({...})
export class MyComponent {
  constructor(private randomFENService: RandomFENService) {}

  generatePosition() {
    // Generar posición básica (puede ser poco realista)
    const fen = this.randomFENService.generateRandomFEN();
    
    // Generar posición REALISTA (recomendado)
    const realisticFen = this.randomFENService.generateRealisticFEN();
    
    console.log(realisticFen); // Ej: "4K3/8/8/8/8/8/8/4k3 w - - 0 1"
  }
}
```

## Métodos Principales

### 🎯 Generación Básica
- `generateRandomFEN()` - Genera posición aleatoria (puede ser poco realista)
- `generateMultipleFENs()` - Genera múltiples posiciones básicas

### 🏆 Generación Realista (RECOMENDADO)
- `generateRealisticFEN()` - Genera posición respetando límites reales del ajedrez
- `generateMultipleRealisticFENs()` - Genera múltiples posiciones realistas

### 🎮 Generación por Fase de Juego
- `generateEndgameFEN()` - Genera posiciones de final (pocas piezas, sin damas)
- `generateMiddlegameFEN()` - Genera posiciones de medio juego (piezas medias)

### 🔍 Análisis y Validación
- `analyzeFEN()` - Analiza y cuenta piezas en una posición
- `isValidFEN()` - Valida formato FEN
- `isRealisticFEN()` - Verifica si es realista según reglas del ajedrez

## Opciones de Configuración

```typescript
interface RandomFENOptions {
  maxPieces?: number;        // Máximo número de piezas (default: 32)
  includePawns?: boolean;    // Incluir peones (default: true)
  includeQueens?: boolean;   // Incluir reinas (default: true)
  includeRooks?: boolean;    // Incluir torres (default: true)
  includeBishops?: boolean;  // Incluir alfiles (default: true)
  includeKnights?: boolean;  // Incluir caballos (default: true)
}
```

## Ejemplos de Uso

### 🎯 Generar Posición Realista (RECOMENDADO)

```typescript
// Generar posición que respeta las reglas del ajedrez
const realisticFen = this.randomFENService.generateRealisticFEN();

// Con configuración personalizada
const fen = this.randomFENService.generateRealisticFEN({
  maxPieces: 15,
  includePawns: true,
  includeQueens: false
});
```

### 🎮 Generar por Fase de Juego

```typescript
// Generar final de partida (pocas piezas, sin damas)
const endgameFen = this.randomFENService.generateEndgameFEN();

// Generar medio juego (piezas medias)
const middlegameFen = this.randomFENService.generateMiddlegameFEN();
```

### 🔍 Analizar Posiciones

```typescript
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1";

// Contar piezas
const stats = this.randomFENService.analyzeFEN(fen);
console.log(stats); // { K: 1, Q: 1, R: 2, N: 2, B: 2, P: 8, k: 1, q: 1, r: 2, n: 2, b: 2, p: 8 }

// Verificar si es realista
const isRealistic = this.randomFENService.isRealisticFEN(fen); // true
```

## Casos de Uso Comunes

### 1. 🎯 Generar puzzles realistas
```typescript
// Generar posición realista para principiantes
const beginnerPosition = this.randomFENService.generateRealisticFEN({
  maxPieces: 8,
  includePawns: false
});
```

### 2. 🎮 Crear ejercicios por fase de juego
```typescript
// Ejercicio de final
const endgameExercise = this.randomFENService.generateEndgameFEN();

// Ejercicio de medio juego
const middlegameExercise = this.randomFENService.generateMiddlegameFEN();
```

### 3. 🧪 Testing de aplicaciones de ajedrez
```typescript
// Generar múltiples posiciones realistas para testing
const testPositions = this.randomFENService.generateMultipleRealisticFENs(100);
testPositions.forEach(fen => {
  expect(this.randomFENService.isRealisticFEN(fen)).toBe(true);
});
```

## Límites Realistas del Ajedrez

El servicio respeta **EXACTAMENTE** las reglas del ajedrez:

| Pieza | Blanco | Negro | Total |
|-------|--------|-------|-------|
| Rey   | 1      | 1     | 2     |
| Dama  | 1      | 1     | 2     |
| Torre | 2      | 2     | 4     |
| Alfil | 2      | 2     | 4     |
| Caballo | 2    | 2     | 4     |
| Peón  | 8      | 8     | 16    |

## Notas Técnicas

- **Reyes**: Siempre se colocan en posiciones no adyacentes
- **Peones**: Nunca se colocan en la primera o última fila
- **Límites**: Se respetan estrictamente los límites de piezas por color
- **Realismo**: Las posiciones generadas simulan partidas reales de ajedrez
- **FEN**: Siempre incluye el sufijo estándar " w - - 0 1"

## Dependencias

- Angular Core
- No requiere dependencias externas

## Compatibilidad

- Angular 12+
- TypeScript 4.0+
- Navegadores modernos con soporte para ES2015+
