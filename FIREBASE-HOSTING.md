# 🚀 Firebase Hosting - Múltiples Sitios

Este proyecto está configurado para usar Firebase Hosting con múltiples sitios, uno para cada aplicación del workspace Nx.

## 📋 Configuración Actual

### Sitios Configurados

| App | Target Firebase | URL |
|-----|----------------|-----|
| `chesspark` | `chesspark-app` | `https://chesspark-app.web.app` |
| `chessCoordinatesTrainer` | `chess-coordinates-trainer-app` | `https://chess-coordinates-trainer-app.web.app` |
| `chessColate` | `chesscolate-app` | `https://chesscolate-app.web.app` |

## 🛠️ Comandos Disponibles

### Deploy Individual

```bash
# Deploy solo chesspark
nx run chesspark:deploy

# Deploy solo chessCoordinatesTrainer
nx run chessCoordinatesTrainer:deploy

# Deploy solo chessColate
nx run chessColate:deploy
```

### Deploy con Script

```bash
# Deploy todas las apps
./deploy-firebase.sh

# Deploy app específica
./deploy-firebase.sh chesspark
./deploy-firebase.sh chessCoordinatesTrainer
./deploy-firebase.sh chessColate
```

### Comandos Firebase Directos

```bash
# Deploy solo hosting de una app
firebase deploy --only hosting:chesspark
firebase deploy --only hosting:chessCoordinatesTrainer
firebase deploy --only hosting:chessColate

# Deploy todo
firebase deploy

# Ver estado de los sitios
firebase hosting:sites:list
```

## 🔧 Configuración

### firebase.json
El archivo `firebase.json` contiene la configuración de hosting para cada app:

```json
{
  "hosting": [
    {
      "target": "chesspark",
      "public": "dist/apps/chesspark",
      "rewrites": [{"source": "**", "destination": "/index.html"}]
    },
    {
      "target": "chessCoordinatesTrainer", 
      "public": "dist/apps/chessCoordinatesTrainer",
      "rewrites": [{"source": "**", "destination": "/index.html"}]
    },
    {
      "target": "chessColate",
      "public": "dist/apps/chessColate", 
      "rewrites": [{"source": "**", "destination": "/index.html"}]
    }
  ]
}
```

### .firebaserc
El archivo `.firebaserc` mapea los targets a los sitios de Firebase:

```json
{
  "targets": {
    "chesspark-53bce": {
      "hosting": {
        "chesspark": ["chesspark-app"],
        "chessCoordinatesTrainer": ["chess-coordinates-trainer-app"],
        "chessColate": ["chesscolate-app"]
      }
    }
  }
}
```

## 📁 Estructura de Directorios

```
dist/
├── apps/
│   ├── chesspark/           # Build de chesspark
│   ├── chessCoordinatesTrainer/  # Build de chessCoordinatesTrainer
│   └── chessColate/         # Build de chessColate
```

## 🚀 Flujo de Deploy

1. **Build**: Cada app se construye en su directorio correspondiente
2. **Deploy**: Firebase sube los archivos del directorio `public` especificado
3. **Routing**: Todas las rutas se redirigen a `index.html` para SPA

## ⚠️ Notas Importantes

- **Build antes de Deploy**: Siempre ejecuta `nx build [app-name]` antes de hacer deploy
- **Dependencias**: El target `deploy` depende automáticamente del target `build`
- **SPA**: Todas las apps están configuradas como Single Page Applications
- **Caché**: Firebase Hosting cachea automáticamente los archivos estáticos

## 🔍 Troubleshooting

### Error de Build
```bash
# Verificar que la app se construye correctamente
nx build chesspark
nx build chessCoordinatesTrainer
nx build chessColate
```

### Error de Deploy
```bash
# Verificar configuración de Firebase
firebase projects:list
firebase use --add

# Verificar targets
firebase target:list
```

### Limpiar Caché
```bash
# Limpiar build anterior
nx reset
rm -rf dist/

# Reconstruir
nx build chesspark
```

## 📚 Recursos Adicionales

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Nx Documentation](https://nx.dev/)
- [Angular Build Documentation](https://angular.io/guide/build)
