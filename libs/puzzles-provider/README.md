# @chesspark/puzzles-provider

Librería TypeScript para obtener puzzles de ajedrez desde CDN con caché local inteligente.

## Características

- ✅ **TypeScript puro**: Sin dependencias de frameworks específicos
- 🚀 **Caché local**: Usa IndexedDB para almacenamiento eficiente
- 🎯 **Búsqueda inteligente por ELO**: Incrementa/decrementa automáticamente para obtener la cantidad de puzzles requerida
- 🎨 **Múltiples temas**: Soporte para más de 50 temas diferentes
- ♟️ **Aperturas**: Soporte para más de 60 aperturas diferentes
- 🔄 **Flexible**: Configurable y extensible

## Instalación

```bash
npm install @chesspark/puzzles-provider
```

## Uso Básico

```typescript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

// Crear e inicializar el proveedor
const provider = await createPuzzlesProvider();

// Obtener 200 puzzles de nivel 1500
const puzzles = await provider.getPuzzles({ elo: 1500 });

console.log(puzzles);
```

## Ejemplos Avanzados

### Obtener puzzles de un tema específico

```typescript
const puzzles = await provider.getPuzzles({
  elo: 1800,
  theme: 'fork',
  count: 100,
});
```

### Obtener puzzles de una apertura

```typescript
const puzzles = await provider.getPuzzles({
  elo: 1600,
  openingFamily: 'Sicilian_Defense',
  count: 150,
});
```

### Filtrar por color

```typescript
// Obtener puzzles donde el jugador juega con blancas
const whitePuzzles = await provider.getPuzzles({
  elo: 1500,
  color: 'w',
  count: 200,
});
```

### Configuración personalizada

```typescript
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

const provider = new PuzzlesProvider({
  cdnBaseUrl: 'https://cdn.jsdelivr.net/gh',
  githubUser: 'json-alzate',
  enableCache: true,
  cacheExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7 días
});

await provider.init();
```

## API

### `PuzzlesProvider`

Clase principal para obtener puzzles.

#### Constructor

```typescript
constructor(config?: PuzzlesProviderConfig)
```

**Parámetros:**
- `config` (opcional): Configuración del proveedor
  - `cdnBaseUrl`: URL base del CDN (por defecto: `https://cdn.jsdelivr.net/gh`)
  - `githubUser`: Usuario de GitHub (por defecto: `json-alzate`)
  - `enableCache`: Habilitar caché local (por defecto: `true`)
  - `cacheExpirationMs`: Tiempo de expiración del caché en ms (por defecto: 7 días)

#### Métodos

##### `init(): Promise<void>`

Inicializa el proveedor. Debe llamarse antes de usar `getPuzzles`.

##### `getPuzzles(options?: PuzzleQueryOptions): Promise<Puzzle[]>`

Obtiene puzzles según los criterios especificados.

**Parámetros:**
- `options` (opcional): Opciones de consulta
  - `elo`: Nivel de ELO (por defecto: 1500)
  - `theme`: Tema del puzzle (opcional)
  - `openingFamily`: Familia de apertura (opcional)
  - `color`: Color del jugador ('w', 'b' o 'N/A')
  - `count`: Cantidad de puzzles a devolver (por defecto: 200, máximo: 200)

**Retorna:** Array de puzzles que cumplen los criterios.

##### `clearCache(): Promise<void>`

Limpia todo el caché de puzzles.

##### `getCacheSize(): Promise<number>`

Obtiene el número de entradas en el caché.

##### `close(): void`

Cierra la conexión del caché. Debe llamarse cuando ya no se vaya a usar el proveedor.

### `createPuzzlesProvider(config?: PuzzlesProviderConfig): Promise<PuzzlesProvider>`

Función helper para crear y inicializar rápidamente un proveedor.

## Tipos

### `Puzzle`

```typescript
interface Puzzle {
  uid: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation?: number;
  popularity?: number;
  nbPlays?: number;
  themes?: string[];
  gameUrl?: string;
  openingFamily?: string;
  openingVariation?: string;
}
```

### `PuzzleQueryOptions`

```typescript
interface PuzzleQueryOptions {
  elo?: number;
  theme?: string;
  openingFamily?: string;
  color?: 'w' | 'b' | 'N/A';
  count?: number;
}
```

## Constantes

### Temas disponibles

Puedes importar la lista completa de temas:

```typescript
import { AVAILABLE_THEMES } from '@chesspark/puzzles-provider';

console.log(AVAILABLE_THEMES);
// ['opening', 'middlegame', 'endgame', 'fork', 'pin', ...]
```

### Aperturas disponibles

```typescript
import { AVAILABLE_OPENINGS } from '@chesspark/puzzles-provider';

console.log(AVAILABLE_OPENINGS);
// ['Sicilian_Defense', 'French_Defense', 'Italian_Game', ...]
```

## Cómo Funciona

### Búsqueda Inteligente por ELO

La librería implementa una búsqueda inteligente cuando no hay suficientes puzzles en el rango de ELO especificado:

1. **Búsqueda inicial**: Busca puzzles en el rango de ELO especificado (ej: 1500-1519)
2. **Incremento**: Si no hay suficientes, busca en rangos superiores (1520-1539, 1540-1559, ...)
3. **Decremento**: Si aún no hay suficientes, busca en rangos inferiores (1480-1499, 1460-1479, ...)
4. **Límites**: Se detiene al llegar a los límites (400 o 2800)

### Sistema de Caché

- Usa **IndexedDB** para almacenamiento local eficiente
- Almacena los puzzles descargados por URL
- Verifica automáticamente la expiración (configurable)
- No bloquea la respuesta al cachear

## Ejemplos de Uso en Aplicaciones

### Angular

```typescript
import { Injectable } from '@angular/core';
import { PuzzlesProvider } from '@chesspark/puzzles-provider';

@Injectable({
  providedIn: 'root'
})
export class PuzzlesService {
  private provider!: PuzzlesProvider;

  async init() {
    this.provider = new PuzzlesProvider();
    await this.provider.init();
  }

  async getPuzzles(elo: number) {
    return await this.provider.getPuzzles({ elo });
  }
}
```

### React

```typescript
import { useEffect, useState } from 'react';
import { createPuzzlesProvider, Puzzle } from '@chesspark/puzzles-provider';

function usePuzzles(elo: number) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPuzzles() {
      const provider = await createPuzzlesProvider();
      const data = await provider.getPuzzles({ elo });
      setPuzzles(data);
      setLoading(false);
      provider.close();
    }
    fetchPuzzles();
  }, [elo]);

  return { puzzles, loading };
}
```

### Vanilla JavaScript

```javascript
import { createPuzzlesProvider } from '@chesspark/puzzles-provider';

async function loadPuzzles() {
  const provider = await createPuzzlesProvider();
  const puzzles = await provider.getPuzzles({ elo: 1500, count: 100 });
  
  console.log(`Loaded ${puzzles.length} puzzles`);
  
  provider.close();
}

loadPuzzles();
```

## Desarrollo

### Construir la librería

```bash
nx build puzzles-provider
```

### Ejecutar tests

```bash
nx test puzzles-provider
```

### Linting

```bash
nx lint puzzles-provider
```

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Crea un Pull Request

## Licencia

MIT
