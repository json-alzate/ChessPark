# Ejemplos de Uso - @chesspark/puzzles-provider

Este documento contiene ejemplos prácticos de cómo usar la librería `@chesspark/puzzles-provider` en diferentes escenarios.

## Tabla de Contenidos

- [Uso Básico](#uso-básico)
- [Configuración Avanzada](#configuración-avanzada)
- [Optimización de Rendimiento](#optimización-de-rendimiento)
- [Búsqueda por Temas](#búsqueda-por-temas)
- [Búsqueda por Aperturas](#búsqueda-por-aperturas)
- [Filtrado por Color](#filtrado-por-color)
- [Manejo de Caché](#manejo-de-caché)
- [Integración con Frameworks](#integración-con-frameworks)
- [Casos de Uso Reales](#casos-de-uso-reales)

## Uso Básico

### Ejemplo 1: Obtener puzzles de nivel principiante

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getPuzzlesForBeginner() {
  const provider = await createPuzzlesProvider();
  
  // Obtener 100 puzzles de nivel 800-1200 (principiante)
  const puzzles = await provider.getPuzzles({
    elo: 1000,
    count: 100,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles para principiantes`);
  
  puzzles.forEach((puzzle, index) => {
    console.log(`${index + 1}. Puzzle ${puzzle.uid} - Rating: ${puzzle.rating}`);
    console.log(`   FEN: ${puzzle.fen}`);
    console.log(`   Movimientos: ${puzzle.moves}`);
  });

  provider.close();
}
```

### Ejemplo 2: Obtener puzzles de nivel intermedio

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getPuzzlesForIntermediate() {
  const provider = await createPuzzlesProvider();
  
  // Obtener puzzles de nivel 1400-1800 (intermedio)
  const puzzles = await provider.getPuzzles({
    elo: 1600,
    count: 150,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles para jugadores intermedios`);
  provider.close();
}
```

### Ejemplo 3: Obtener puzzles de nivel avanzado

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getPuzzlesForAdvanced() {
  const provider = await createPuzzlesProvider();
  
  // Obtener puzzles de nivel 2000+ (avanzado)
  const puzzles = await provider.getPuzzles({
    elo: 2200,
    count: 200,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles para jugadores avanzados`);
  provider.close();
}
```

## Configuración Avanzada

### Ejemplo 4: Configuración personalizada del proveedor

```typescript
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

async function customConfig() {
  const provider = new PuzzlesProvider({
    cdnBaseUrl: 'https://cdn.jsdelivr.net/gh',
    githubUser: 'json-alzate',
    enableCache: true,
    cacheExpirationMs: 14 * 24 * 60 * 60 * 1000, // 14 días
    maxConcurrentDownloads: 5, // Máximo de descargas simultáneas
    batchSize: 3, // Tamaño del batch para procesar ELOs
  });

  await provider.init();

  const puzzles = await provider.getPuzzles({ elo: 1500 });
  console.log(`Obtenidos ${puzzles.length} puzzles con configuración personalizada`);

  provider.close();
}
```

### Ejemplo 5: Deshabilitar caché

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function withoutCache() {
  // Útil para siempre obtener datos frescos del CDN
  const provider = await createPuzzlesProvider({
    enableCache: false,
  });

  const puzzles = await provider.getPuzzles({ elo: 1500 });
  console.log(`Obtenidos ${puzzles.length} puzzles sin caché`);

  provider.close();
}
```

## Optimización de Rendimiento

### Ejemplo 6: Configuración para conexiones rápidas

```typescript
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

async function fastConnectionConfig() {
  // Para conexiones rápidas, aumentar la concurrencia y el batch size
  const provider = new PuzzlesProvider({
    maxConcurrentDownloads: 10, // Más descargas simultáneas
    batchSize: 5, // Batches más grandes
    enableCache: true,
  });

  await provider.init();

  const startTime = Date.now();
  const puzzles = await provider.getPuzzles({ elo: 1500, count: 200 });
  const endTime = Date.now();

  console.log(`Obtenidos ${puzzles.length} puzzles en ${endTime - startTime}ms`);
  provider.close();
}
```

### Ejemplo 7: Configuración para conexiones lentas o móviles

```typescript
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

async function slowConnectionConfig() {
  // Para conexiones lentas, reducir la concurrencia y el batch size
  const provider = new PuzzlesProvider({
    maxConcurrentDownloads: 3, // Menos descargas simultáneas
    batchSize: 2, // Batches más pequeños
    enableCache: true, // El caché es especialmente importante aquí
  });

  await provider.init();

  const puzzles = await provider.getPuzzles({ elo: 1500, count: 100 });
  console.log(`Obtenidos ${puzzles.length} puzzles optimizados para conexión lenta`);

  provider.close();
}
```

### Ejemplo 8: Cargar múltiples bloques en paralelo

```typescript
import { createPuzzlesProvider, Puzzle } from '@chesspark/puzzles-provider';

interface Block {
  elo: number;
  theme?: string;
  openingFamily?: string;
  puzzles?: Puzzle[];
}

async function loadMultipleBlocksInParallel() {
  const provider = await createPuzzlesProvider();

  // Definir múltiples bloques de entrenamiento
  const blocks: Block[] = [
    { elo: 1500, theme: 'fork' },
    { elo: 1600, theme: 'pin' },
    { elo: 1700, theme: 'mateIn2' },
    { elo: 1400, openingFamily: 'Sicilian_Defense' },
  ];

  console.log('Cargando bloques en paralelo...');
  const startTime = Date.now();

  // Cargar todos los bloques en paralelo (mucho más rápido)
  const puzzlePromises = blocks.map(async (block, index) => {
    const puzzles = await provider.getPuzzles({
      elo: block.elo,
      theme: block.theme,
      openingFamily: block.openingFamily,
      count: 50,
    });
    
    block.puzzles = puzzles;
    console.log(`Bloque ${index + 1} cargado: ${puzzles.length} puzzles`);
    return block;
  });

  await Promise.all(puzzlePromises);

  const endTime = Date.now();
  console.log(`Todos los bloques cargados en ${endTime - startTime}ms`);

  // Los bloques ahora tienen sus puzzles cargados
  blocks.forEach((block, index) => {
    console.log(`Bloque ${index + 1}: ${block.puzzles?.length} puzzles`);
  });

  provider.close();
}
```

### Ejemplo 9: Comparación de rendimiento (secuencial vs paralelo)

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function performanceComparison() {
  const provider = await createPuzzlesProvider();
  const blocks = [
    { elo: 1500, theme: 'fork' },
    { elo: 1600, theme: 'pin' },
    { elo: 1700, theme: 'mateIn2' },
  ];

  // Método secuencial (lento)
  console.log('Cargando secuencialmente...');
  const sequentialStart = Date.now();
  for (const block of blocks) {
    await provider.getPuzzles({ elo: block.elo, theme: block.theme, count: 50 });
  }
  const sequentialEnd = Date.now();
  console.log(`Tiempo secuencial: ${sequentialEnd - sequentialStart}ms`);

  // Método paralelo (rápido)
  console.log('Cargando en paralelo...');
  const parallelStart = Date.now();
  await Promise.all(
    blocks.map(block =>
      provider.getPuzzles({ elo: block.elo, theme: block.theme, count: 50 })
    )
  );
  const parallelEnd = Date.now();
  console.log(`Tiempo paralelo: ${parallelEnd - parallelStart}ms`);

  const improvement = ((sequentialEnd - sequentialStart) / (parallelEnd - parallelStart) - 1) * 100;
  console.log(`Mejora: ${improvement.toFixed(1)}% más rápido`);

  provider.close();
}
```

## Búsqueda por Temas

### Ejemplo 10: Puzzles de táctica específica (Fork)

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getForkPuzzles() {
  const provider = await createPuzzlesProvider();
  
  const puzzles = await provider.getPuzzles({
    elo: 1600,
    theme: 'fork',
    count: 50,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles de tenedor (fork)`);
  provider.close();
}
```

### Ejemplo 11: Puzzles de mate

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getMatePuzzles() {
  const provider = await createPuzzlesProvider();
  
  // Puzzles de mate en general
  const matePuzzles = await provider.getPuzzles({
    elo: 1500,
    theme: 'mate',
    count: 100,
  });

  // Puzzles de mate en 2
  const mateIn2 = await provider.getPuzzles({
    elo: 1700,
    theme: 'mateIn2',
    count: 50,
  });

  console.log(`Obtenidos ${matePuzzles.length} puzzles de mate`);
  console.log(`Obtenidos ${mateIn2.length} puzzles de mate en 2`);

  provider.close();
}
```

### Ejemplo 8: Puzzles de final de partida

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getEndgamePuzzles() {
  const provider = await createPuzzlesProvider();
  
  const endgamePuzzles = await provider.getPuzzles({
    elo: 1800,
    theme: 'endgame',
    count: 100,
  });

  // Finales de torre
  const rookEndgame = await provider.getPuzzles({
    elo: 1900,
    theme: 'rookEndgame',
    count: 50,
  });

  console.log(`Obtenidos ${endgamePuzzles.length} puzzles de final de partida`);
  console.log(`Obtenidos ${rookEndgame.length} puzzles de final de torres`);

  provider.close();
}
```

### Ejemplo 9: Listar todos los temas disponibles

```typescript
import { AVAILABLE_THEMES } from '@chesspark/puzzles-provider';

function listAvailableThemes() {
  console.log('Temas disponibles:');
  AVAILABLE_THEMES.forEach((theme, index) => {
    console.log(`${index + 1}. ${theme}`);
  });
  console.log(`Total: ${AVAILABLE_THEMES.length} temas`);
}
```

## Búsqueda por Aperturas

### Ejemplo 10: Puzzles de Defensa Siciliana

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getSicilianPuzzles() {
  const provider = await createPuzzlesProvider();
  
  const puzzles = await provider.getPuzzles({
    elo: 1700,
    openingFamily: 'Sicilian_Defense',
    count: 100,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles de Defensa Siciliana`);
  provider.close();
}
```

### Ejemplo 11: Puzzles de Apertura Italiana

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getItalianGamePuzzles() {
  const provider = await createPuzzlesProvider();
  
  const puzzles = await provider.getPuzzles({
    elo: 1500,
    openingFamily: 'Italian_Game',
    count: 80,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles de Apertura Italiana`);
  provider.close();
}
```

### Ejemplo 12: Listar todas las aperturas disponibles

```typescript
import { AVAILABLE_OPENINGS } from '@chesspark/puzzles-provider';

function listAvailableOpenings() {
  console.log('Aperturas disponibles:');
  AVAILABLE_OPENINGS.forEach((opening, index) => {
    console.log(`${index + 1}. ${opening}`);
  });
  console.log(`Total: ${AVAILABLE_OPENINGS.length} aperturas`);
}
```

## Filtrado por Color

### Ejemplo 13: Puzzles donde juegan las blancas

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getWhitePuzzles() {
  const provider = await createPuzzlesProvider();
  
  const puzzles = await provider.getPuzzles({
    elo: 1600,
    color: 'w',
    count: 100,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles donde juegan las blancas`);
  
  // Verificar que todos son con blancas
  puzzles.forEach(puzzle => {
    const turn = puzzle.fen.split(' ')[1];
    console.assert(turn === 'w', 'Error: puzzle no es con blancas');
  });

  provider.close();
}
```

### Ejemplo 14: Puzzles donde juegan las negras

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function getBlackPuzzles() {
  const provider = await createPuzzlesProvider();
  
  const puzzles = await provider.getPuzzles({
    elo: 1600,
    color: 'b',
    theme: 'sacrifice',
    count: 100,
  });

  console.log(`Obtenidos ${puzzles.length} puzzles de sacrificio donde juegan las negras`);
  provider.close();
}
```

## Manejo de Caché

### Ejemplo 15: Verificar y limpiar caché

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function manageCacheExample() {
  const provider = await createPuzzlesProvider();

  // Obtener tamaño del caché
  const cacheSize = await provider.getCacheSize();
  console.log(`Tamaño del caché: ${cacheSize} entradas`);

  // Obtener puzzles (se cachearán automáticamente)
  await provider.getPuzzles({ elo: 1500, count: 100 });

  // Verificar nuevo tamaño
  const newCacheSize = await provider.getCacheSize();
  console.log(`Nuevo tamaño del caché: ${newCacheSize} entradas`);

  // Limpiar caché si es necesario
  await provider.clearCache();
  console.log('Caché limpiado');

  const finalCacheSize = await provider.getCacheSize();
  console.log(`Tamaño final del caché: ${finalCacheSize} entradas`);

  provider.close();
}
```

### Ejemplo 16: Pre-cachear puzzles comunes

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function precachePuzzles() {
  const provider = await createPuzzlesProvider();

  console.log('Pre-cacheando puzzles comunes...');

  // Pre-cachear diferentes rangos de ELO
  const eloRanges = [1000, 1200, 1400, 1600, 1800, 2000];
  
  for (const elo of eloRanges) {
    await provider.getPuzzles({ elo, count: 50 });
    console.log(`✓ Cacheados puzzles para ELO ${elo}`);
  }

  const cacheSize = await provider.getCacheSize();
  console.log(`Caché completado: ${cacheSize} entradas`);

  provider.close();
}
```

## Integración con Frameworks

### Ejemplo 17: Hook de React

```typescript
// usePuzzles.ts
import { useState, useEffect } from 'react';
import { createPuzzlesProvider, Puzzle, PuzzleQueryOptions } from '@chesspark/puzzles-provider';

export function usePuzzles(options: PuzzleQueryOptions) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPuzzles() {
      try {
        setLoading(true);
        const provider = await createPuzzlesProvider();
        const data = await provider.getPuzzles(options);
        
        if (!cancelled) {
          setPuzzles(data);
          setError(null);
        }
        
        provider.close();
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPuzzles();

    return () => {
      cancelled = true;
    };
  }, [options.elo, options.theme, options.openingFamily, options.color, options.count]);

  return { puzzles, loading, error };
}

// Uso del hook
function PuzzlesComponent() {
  const { puzzles, loading, error } = usePuzzles({ elo: 1600, count: 100 });

  if (loading) return <div>Cargando puzzles...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Puzzles ({puzzles.length})</h2>
      {puzzles.map(puzzle => (
        <div key={puzzle.uid}>
          <p>Rating: {puzzle.rating}</p>
          <p>FEN: {puzzle.fen}</p>
        </div>
      ))}
    </div>
  );
}
```

### Ejemplo 18: Servicio de Angular

```typescript
// puzzles.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  PuzzlesProvider, 
  Puzzle, 
  PuzzleQueryOptions 
} from '@chesspark/puzzles-provider';

@Injectable({
  providedIn: 'root'
})
export class PuzzlesService implements OnDestroy {
  private provider!: PuzzlesProvider;
  private puzzlesSubject = new BehaviorSubject<Puzzle[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  puzzles$: Observable<Puzzle[]> = this.puzzlesSubject.asObservable();
  loading$: Observable<boolean> = this.loadingSubject.asObservable();

  async init() {
    this.provider = new PuzzlesProvider();
    await this.provider.init();
  }

  async getPuzzles(options: PuzzleQueryOptions): Promise<void> {
    try {
      this.loadingSubject.next(true);
      const puzzles = await this.provider.getPuzzles(options);
      this.puzzlesSubject.next(puzzles);
    } catch (error) {
      console.error('Error al obtener puzzles:', error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async clearCache(): Promise<void> {
    await this.provider.clearCache();
  }

  ngOnDestroy() {
    this.provider.close();
  }
}

// Uso en componente
@Component({
  selector: 'app-puzzles',
  template: `
    <div *ngIf="loading$ | async">Cargando...</div>
    <div *ngFor="let puzzle of puzzles$ | async">
      {{ puzzle.uid }} - Rating: {{ puzzle.rating }}
    </div>
  `
})
export class PuzzlesComponent implements OnInit {
  puzzles$ = this.puzzlesService.puzzles$;
  loading$ = this.puzzlesService.loading$;

  constructor(private puzzlesService: PuzzlesService) {}

  async ngOnInit() {
    await this.puzzlesService.init();
    await this.puzzlesService.getPuzzles({ elo: 1600 });
  }
}
```

## Casos de Uso Reales

### Ejemplo 19: Sistema de entrenamiento diario

```typescript
import { createPuzzlesProvider, Puzzle } from '@chesspark/puzzles-provider';

interface DailyTraining {
  date: string;
  puzzles: Puzzle[];
  userElo: number;
}

async function generateDailyTraining(userElo: number): Promise<DailyTraining> {
  const provider = await createPuzzlesProvider();

  // Generar puzzles variados para entrenamiento diario
  const tactics = await provider.getPuzzles({
    elo: userElo,
    theme: 'fork',
    count: 10,
  });

  const mates = await provider.getPuzzles({
    elo: userElo - 100, // Un poco más fácil
    theme: 'mateIn2',
    count: 5,
  });

  const endgames = await provider.getPuzzles({
    elo: userElo + 100, // Un poco más difícil
    theme: 'endgame',
    count: 5,
  });

  const allPuzzles = [...tactics, ...mates, ...endgames];

  provider.close();

  return {
    date: new Date().toISOString().split('T')[0],
    puzzles: allPuzzles,
    userElo,
  };
}

// Uso
async function startDailyTraining() {
  const userElo = 1600;
  const training = await generateDailyTraining(userElo);
  
  console.log(`Entrenamiento diario del ${training.date}`);
  console.log(`Total de puzzles: ${training.puzzles.length}`);
  console.log(`Nivel del usuario: ${training.userElo}`);
}
```

### Ejemplo 20: Sistema de progresión adaptativa

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

interface UserProgress {
  currentElo: number;
  correctAnswers: number;
  totalAttempts: number;
}

async function getAdaptivePuzzles(progress: UserProgress) {
  const provider = await createPuzzlesProvider();
  
  // Calcular tasa de éxito
  const successRate = progress.correctAnswers / progress.totalAttempts;
  
  // Ajustar ELO según desempeño
  let targetElo = progress.currentElo;
  if (successRate > 0.8) {
    targetElo += 100; // Incrementar dificultad
  } else if (successRate < 0.4) {
    targetElo -= 100; // Reducir dificultad
  }

  const puzzles = await provider.getPuzzles({
    elo: targetElo,
    count: 20,
  });

  provider.close();

  return {
    puzzles,
    recommendedElo: targetElo,
    adjustment: targetElo - progress.currentElo,
  };
}

// Uso
async function adaptiveTraining() {
  const userProgress: UserProgress = {
    currentElo: 1600,
    correctAnswers: 45,
    totalAttempts: 50,
  };

  const result = await getAdaptivePuzzles(userProgress);
  
  console.log(`ELO recomendado: ${result.recommendedElo}`);
  console.log(`Ajuste: ${result.adjustment > 0 ? '+' : ''}${result.adjustment}`);
  console.log(`Puzzles obtenidos: ${result.puzzles.length}`);
}
```

## Conclusión

Estos ejemplos cubren los casos de uso más comunes de la librería. Para más información, consulta el [README principal](./README.md).

