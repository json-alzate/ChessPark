# Board Library

Esta librería proporciona un componente de tablero de ajedrez utilizando `cm-chessboard`.

## Instalación y Configuración

### Assets Requeridos

Esta librería requiere que los assets de `cm-chessboard` estén disponibles en cada aplicación que la use.

#### Para aplicaciones Ionic (como chessCoordinatesTrainer):
Los assets deben estar en: `src/assets/cm-chessboard/assets/`

#### Para aplicaciones web (como chesspark):
Los assets deben estar en: `public/cm-chessboard/assets/`

### Configuración Automática

El workspace incluye un script que copia automáticamente los assets:

```bash
npm run copy-chessboard-assets
```

Este script se ejecuta automáticamente después de `npm install`.

### Configuración Manual

Si necesitas copiar los assets manualmente:

```bash
# Para aplicaciones Ionic
mkdir -p apps/[app-name]/src/assets/cm-chessboard/assets
cp -r node_modules/cm-chessboard/assets/* apps/[app-name]/src/assets/cm-chessboard/assets/

# Para aplicaciones web
mkdir -p apps/[app-name]/public/cm-chessboard/assets
cp -r node_modules/cm-chessboard/assets/* apps/[app-name]/public/cm-chessboard/assets/
```

## Uso

```typescript
import { BoardComponent } from '@chesspark/board';

// En tu componente
<lib-board></lib-board>
```

## Configuración del Tablero

El componente acepta las siguientes configuraciones:

- `coordinates`: Mostrar coordenadas (default: false)
- `responsive`: Tablero responsivo (default: true)
- `position`: Posición inicial en notación FEN
- `assetsUrl`: Ruta a los assets (configurado automáticamente)
