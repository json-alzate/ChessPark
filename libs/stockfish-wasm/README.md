# @chesspark/stockfish-wasm

Librería Angular para interactuar con el motor de ajedrez Stockfish WebAssembly. Proporciona una API sencilla y bien tipada para evaluar posiciones, obtener mejores movimientos y realizar análisis de ajedrez.

## 🚀 Características

- **Evaluación de posiciones**: Obtén el score de cualquier posición en notación FEN
- **Mejor movimiento**: Encuentra el mejor movimiento con análisis configurable
- **Análisis profundo**: Análisis con profundidad, límite de tiempo y nodos configurables
- **Múltiples variantes**: Obtén los N mejores movimientos para una posición
- **Análisis reactivo**: Observables para análisis en tiempo real
- **Tipado fuerte**: Interfaces TypeScript completas para todas las respuestas
- **Configuración flexible**: Personaliza threads, hash, skill level y más

## 📦 Instalación

La librería está disponible en el workspace de ChessPark. No requiere instalación adicional de paquetes npm.

## 🔧 Uso Básico

### Inicialización

```typescript
import { StockfishService } from '@chesspark/stockfish-wasm';

constructor(private stockfish: StockfishService) {}

async ngOnInit() {
  // Inicializar el motor
  await this.stockfish.initialize();
  
  // O con configuración personalizada
  await this.stockfish.initialize({
    threads: 2,
    hash: 32,
    depth: 18
  });
}
```

### Evaluar una Posición

```typescript
import { StockfishEvaluationService } from '@chesspark/stockfish-wasm';

constructor(
  private stockfish: StockfishService,
  private evaluation: StockfishEvaluationService
) {}

async evaluatePosition() {
  await this.stockfish.initialize();
  
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  // Obtener solo el score
  const score = await this.evaluation.getPositionScore(fen, 15);
  console.log('Score:', score); // Score en centipawns
  
  // Obtener evaluación completa
  const evaluation = await this.evaluation.evaluatePosition(fen, 18);
  console.log('Score:', evaluation.score);
  console.log('Depth:', evaluation.depth);
  console.log('Best move:', evaluation.bestMove);
  console.log('Principal variation:', evaluation.pv);
}
```

### Obtener Mejor Movimiento

```typescript
import { StockfishAnalysisService } from '@chesspark/stockfish-wasm';

constructor(
  private stockfish: StockfishService,
  private analysis: StockfishAnalysisService
) {}

async getBestMove() {
  await this.stockfish.initialize();
  
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  // Obtener mejor movimiento con profundidad
  const result = await this.analysis.getBestMove(fen, { depth: 18 });
  console.log('Best move:', result.move);
  console.log('Ponder:', result.ponder);
  
  // Con límite de tiempo
  const result2 = await this.analysis.getBestMove(fen, { 
    timeLimit: 5000 // 5 segundos
  });
  
  // Con límite de nodos
  const result3 = await this.analysis.getBestMove(fen, { 
    nodesLimit: 1000000 
  });
}
```

### Análisis Completo

```typescript
async analyzePosition() {
  await this.stockfish.initialize();
  
  const analysis = await this.analysis.analyzePosition(fen, 20);
  console.log('Best move:', analysis.bestMove);
  console.log('Principal variation:', analysis.pv);
  console.log('Score:', analysis.score);
  console.log('Nodes evaluated:', analysis.nodes);
  console.log('Time:', analysis.time, 'ms');
}
```

### Múltiples Mejores Movimientos

```typescript
async getTopMoves() {
  await this.stockfish.initialize();
  
  const topMoves = await this.analysis.getMultipleBestMoves(fen, 5, 18);
  
  topMoves.variations.forEach(variation => {
    console.log(`Rank ${variation.rank}: ${variation.move} (score: ${variation.score})`);
    console.log('  Variation:', variation.pv.join(' '));
  });
}
```

### Análisis Reactivo (Observable)

```typescript
import { takeUntil } from 'rxjs/operators';

analyzeReactive() {
  this.stockfish.initialize().then(() => {
    this.evaluation.evaluatePositionAsync(fen, 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        console.log(`Depth ${info.depth}: Score ${info.score} cp`);
        console.log('Principal variation:', info.pv.join(' '));
      });
  });
}
```

### Análisis Continuo

```typescript
analyzeContinuously() {
  this.stockfish.initialize().then(() => {
    this.analysis.analyzeContinuously(fen, { depth: 20 })
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        // Recibir actualizaciones en tiempo real
        this.updateUI(info);
      });
  });
}
```

## 📚 API Completa

### StockfishService

Servicio principal para gestionar el motor Stockfish.

#### Métodos

- **`initialize(config?: StockfishConfig): Promise<void>`**
  - Inicializa el motor Stockfish
  - Configura opciones como threads, hash, skill level

- **`setPosition(fen: string, moves?: string[]): void`**
  - Establece una posición usando notación FEN
  - Opcionalmente aplica movimientos adicionales

- **`setPositionFromStart(moves: string[]): void`**
  - Establece posición desde el inicio con movimientos

- **`stopAnalysis(): void`**
  - Detiene el análisis actual

- **`newGame(): void`**
  - Reinicia el motor (nueva partida)

- **`updateConfig(config: Partial<StockfishConfig>): void`**
  - Actualiza la configuración del motor

- **`getConfig(): StockfishConfig`**
  - Obtiene la configuración actual

- **`terminate(): void`**
  - Termina el motor y libera recursos

#### Propiedades

- **`status$: Observable<StockfishStatus>`** - Estado actual del motor
- **`isReady: boolean`** - Indica si el motor está listo
- **`isAnalyzing: boolean`** - Indica si el motor está analizando

### StockfishEvaluationService

Servicio para evaluar posiciones de ajedrez.

#### Métodos

- **`getPositionScore(fen: string, depth?: number): Promise<number>`**
  - Retorna solo el score en centipawns

- **`evaluatePosition(fen: string, depth?: number): Promise<StockfishEvaluation>`**
  - Evalúa una posición completamente

- **`evaluatePositionAsync(fen: string, depth?: number): Observable<AnalysisInfo>`**
  - Versión reactiva que emite actualizaciones durante el análisis

- **`evaluateMultiplePositions(fens: string[], depth?: number): Promise<StockfishEvaluation[]>`**
  - Evalúa múltiples posiciones secuencialmente

- **`comparePositions(fen1: string, fen2: string, depth?: number): Promise<number>`**
  - Compara dos posiciones y retorna la diferencia de score

### StockfishAnalysisService

Servicio para análisis avanzado y mejores movimientos.

#### Métodos

- **`getBestMove(fen: string, options?: AnalysisOptions): Promise<BestMoveResult>`**
  - Obtiene el mejor movimiento con opciones configurables

- **`analyzePosition(fen: string, depth?: number): Promise<StockfishEvaluation>`**
  - Análisis completo de posición con mejor movimiento y variante principal

- **`getMultipleBestMoves(fen: string, count: number, depth?: number): Promise<MultiPvResult>`**
  - Obtiene los N mejores movimientos ordenados por score

- **`analyzeVariation(fen: string, moves: string[], depth?: number): Promise<StockfishEvaluation>`**
  - Analiza una variante específica de movimientos

- **`analyzeContinuously(fen: string, options?: AnalysisOptions): Observable<AnalysisInfo>`**
  - Análisis continuo con streaming de información

## 🎯 Tipos e Interfaces

### StockfishEvaluation

```typescript
interface StockfishEvaluation {
  score: number;        // Score en centipawns
  depth: number;        // Profundidad alcanzada
  nodes: number;        // Nodos evaluados
  time: number;         // Tiempo en ms
  bestMove?: string;     // Mejor movimiento en UCI
  pv?: string[];         // Principal variation
  mate?: number;         // Movimientos hasta mate
}
```

### AnalysisOptions

```typescript
interface AnalysisOptions {
  depth?: number;       // Profundidad máxima (default: 15)
  timeLimit?: number;    // Límite de tiempo en ms
  nodesLimit?: number;   // Límite de nodos
  multiPv?: number;     // Número de variantes
}
```

### StockfishConfig

```typescript
interface StockfishConfig {
  threads?: number;     // Número de threads (default: 1)
  hash?: number;        // Tamaño de hash en MB (default: 16)
  skillLevel?: number;  // Nivel de habilidad 0-20 (default: 20)
  depth?: number;       // Profundidad por defecto (default: 15)
  workerPath?: string;  // Ruta al Worker (default: '/assets/engine/stockfish-16.1-lite-single.js')
}
```

### BestMoveResult

```typescript
interface BestMoveResult {
  move: string;          // Mejor movimiento en UCI
  ponder?: string;       // Movimiento ponderado
  evaluation?: StockfishEvaluation;
}
```

### MultiPvResult

```typescript
interface MultiPvResult {
  variations: Array<{
    rank: number;        // Ranking (1 = mejor)
    move: string;        // Movimiento principal
    score: number;       // Score en centipawns
    mate?: number;       // Movimientos hasta mate
    pv: string[];        // Principal variation completa
  }>;
}
```

## 🔌 Integración con Apps

### Configuración de Assets

Los archivos de Stockfish (JS y WASM) se incluyen automáticamente en el build de la librería. Asegúrate de que las apps que usen esta librería tengan acceso a los assets en la ruta `/assets/engine/`.

Si necesitas una ruta diferente, puedes configurarla al inicializar:

```typescript
await this.stockfish.initialize({
  workerPath: '/custom/path/to/stockfish-16.1-lite-single.js'
});
```

### Ejemplo Completo en un Componente

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  StockfishService,
  StockfishEvaluationService,
  StockfishAnalysisService
} from '@chesspark/stockfish-wasm';

@Component({
  selector: 'app-chess-analysis',
  templateUrl: './chess-analysis.component.html'
})
export class ChessAnalysisComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  evaluation: any = null;
  bestMove: string = '';
  
  constructor(
    private stockfish: StockfishService,
    private evaluationService: StockfishEvaluationService,
    private analysisService: StockfishAnalysisService
  ) {}
  
  async ngOnInit() {
    try {
      await this.stockfish.initialize({
        threads: 2,
        hash: 32
      });
      
      // Suscribirse al estado
      this.stockfish.status$
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          console.log('Stockfish status:', status);
        });
    } catch (error) {
      console.error('Failed to initialize Stockfish:', error);
    }
  }
  
  async analyzePosition(fen: string) {
    if (!this.stockfish.isReady) {
      return;
    }
    
    try {
      // Evaluar posición
      this.evaluation = await this.evaluationService.evaluatePosition(fen, 18);
      
      // Obtener mejor movimiento
      const result = await this.analysisService.getBestMove(fen, { depth: 18 });
      this.bestMove = result.move;
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stockfish.terminate();
  }
}
```

## 🧪 Testing

```bash
# Ejecutar tests unitarios
nx test stockfish-wasm

# Ejecutar tests con coverage
nx test stockfish-wasm --coverage
```

## 🐛 Troubleshooting

### El motor no se inicializa

- Verifica que los archivos de Stockfish estén en `/assets/engine/`
- Asegúrate de que la ruta del Worker sea correcta
- Revisa la consola del navegador para errores del Worker

### Timeout en análisis

- Aumenta el timeout o reduce la profundidad
- Verifica que el motor esté en estado `Ready` antes de analizar

### Errores de memoria

- Reduce el tamaño del hash (`hash: 16` o menos)
- Reduce el número de threads (`threads: 1`)

### El análisis no se detiene

- Llama a `stockfishService.stopAnalysis()` antes de iniciar un nuevo análisis
- Asegúrate de limpiar suscripciones en `ngOnDestroy`

## 📝 Notas

- El motor Stockfish se ejecuta en un Web Worker para no bloquear el hilo principal
- Los análisis profundos pueden tomar tiempo, considera usar límites de tiempo
- El score está en centipawns (100 centipawns = 1 peón de ventaja)
- Los movimientos están en notación UCI (ej: "e2e4", "g1f3")

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🤝 Contribuir

Para contribuir a esta librería:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 🆘 Soporte

Si tienes alguna pregunta o problema, por favor abre un issue en el repositorio.
