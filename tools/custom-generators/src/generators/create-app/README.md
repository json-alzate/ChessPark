# Generador de Aplicaciones

Este generador crea automáticamente aplicaciones Angular completas con la misma estructura y configuración que `demoA`, incluyendo soporte para Ionic, Angular Elements, Capacitor, Tailwind CSS, DaisyUI, NgRx y más.

## Uso

```bash
nx generate @xerpa/custom-generators:create-app
```

## Opciones

- `name`: Nombre de la aplicación (ej: myApp, dashboard, admin)
- `description`: Descripción de la aplicación
- `hasElements`: ¿Incluir soporte para Angular Elements? (por defecto: true)
- `hasElementsSimple`: ¿Incluir versión simple de Angular Elements? (por defecto: true)
- `hasElementsEnhanced`: ¿Incluir versión mejorada de Angular Elements? (por defecto: true)
- `hasCapacitor`: ¿Incluir configuración de Capacitor para móvil? (por defecto: true)
- `hasIonic`: ¿Incluir soporte para Ionic Framework? (por defecto: true)
- `hasTailwind`: ¿Incluir configuración de Tailwind CSS? (por defecto: true)
- `hasDaisyUI`: ¿Incluir configuración de DaisyUI? (por defecto: true)
- `hasNgRx`: ¿Incluir configuración de NgRx Store? (por defecto: true)
- `hasSwiper`: ¿Incluir soporte para Swiper (carousel)? (por defecto: true)
- `hasServiceWorker`: ¿Incluir configuración de Service Worker? (por defecto: true)
- `hasTests`: ¿Incluir configuración de pruebas con Jest? (por defecto: true)
- `hasLint`: ¿Incluir configuración de ESLint? (por defecto: true)

## Ejemplos

### Crear aplicación básica
```bash
nx generate @xerpa/custom-generators:create-app myApp --description="Mi aplicación personalizada"
```

### Crear aplicación sin Angular Elements
```bash
nx generate @xerpa/custom-generators:create-app dashboard --hasElements=false --description="Dashboard administrativo"
```

### Crear aplicación solo para web
```bash
nx generate @xerpa/custom-generators:create-app webapp --hasCapacitor=false --description="Aplicación solo para web"
```

### Crear aplicación minimalista
```bash
nx generate @xerpa/custom-generators:create-app simple --hasNgRx=false --hasSwiper=false --hasServiceWorker=false --description="Aplicación simple"
```

## Archivos Generados

Para una aplicación llamada `myApp`, se generarán:

### Estructura de Directorios
```
apps/
└── myApp/                        # Directorio de la aplicación
    ├── project.json              # Configuración del proyecto Nx
    ├── package.json              # Información del paquete
    ├── tsconfig.json             # Configuración de TypeScript principal
    ├── tsconfig.app.json         # Configuración de TypeScript para la app
    ├── jest.config.ts            # Configuración de Jest (si hasTests=true)
    ├── capacitor.config.ts       # Configuración de Capacitor (si hasCapacitor=true)
    ├── ionic.config.json         # Configuración de Ionic (si hasIonic=true)
    ├── .postcssrc.json           # Configuración de PostCSS (si hasTailwind=true)
    └── src/                      # Código fuente de la aplicación
        ├── main.ts               # Punto de entrada principal
        ├── main-elements.ts      # Punto de entrada para Angular Elements
        ├── main-elements-simple.ts # Punto de entrada para Angular Elements simple
        ├── main-elements-enhanced.ts # Punto de entrada para Angular Elements mejorado
        ├── index.html            # HTML principal
        ├── index-elements.html   # HTML para Angular Elements
        ├── global.scss           # Estilos globales
        ├── styles-elements.scss  # Estilos para Angular Elements
        ├── polyfills.ts          # Polyfills de Angular
        ├── zone-flags.ts         # Configuración de Zone.js
        ├── ngsw-config.json      # Configuración del Service Worker
        ├── environments/         # Variables de entorno
        ├── theme/                # Variables del tema
        ├── assets/               # Recursos estáticos
        └── app/                  # Componentes de la aplicación
            ├── app.component.ts  # Componente principal
            ├── app.routes.ts     # Rutas de la aplicación
            └── pages/            # Páginas de la aplicación
                └── home/         # Página de inicio
```

## Casos de Uso

### Aplicaciones Completas
- **Con todas las características**: Angular Elements, Capacitor, Ionic, Tailwind, DaisyUI, NgRx
- **Para desarrollo móvil**: Incluye configuración de Capacitor para iOS/Android
- **Para web apps**: Soporte completo para navegadores modernos

### Aplicaciones Web
- **Sin Capacitor**: Solo para desarrollo web
- **Con Angular Elements**: Para integración en otras aplicaciones
- **Con Service Worker**: Para funcionalidad offline

### Aplicaciones Minimalistas
- **Sin NgRx**: Para aplicaciones simples sin estado complejo
- **Sin Swiper**: Para aplicaciones que no requieren carruseles
- **Sin Service Worker**: Para aplicaciones que no necesitan funcionalidad offline

## Características del Generador

### Configuración Automática
- **Nx workspace**: Integración completa con el workspace Nx
- **TypeScript**: Configuración optimizada para Angular
- **Jest**: Configuración de pruebas unitarias
- **ESLint**: Configuración de linting

### Soporte para Frameworks
- **Ionic**: Componentes y estilos de Ionic Framework
- **Angular Elements**: Conversión a Web Components
- **Capacitor**: Desarrollo móvil multiplataforma
- **Tailwind CSS**: Framework de CSS utilitario
- **DaisyUI**: Componentes de UI basados en Tailwind

### Integración con el SDK
- **NgRx Store**: Gestión de estado con NgRx
- **Xerpa UI**: Componentes de UI del proyecto
- **Core Functions**: Funciones core del SDK
- **State Management**: Gestión de estado centralizada

## Estructura de Builds

### Build Principal
```bash
nx build myApp          # Build de la aplicación principal
nx serve myApp          # Servidor de desarrollo
```

### Builds de Angular Elements
```bash
nx build myApp:build-elements          # Build estándar
nx build myApp:build-elements-simple   # Build simple
nx build myApp:build-elements-enhanced # Build mejorado
```

### Servidores de Desarrollo
```bash
nx serve myApp:serve-elements          # Servidor para Angular Elements
```

## Personalización

Después de generar, puedes personalizar:
- **Componentes**: Agregar nuevas páginas y componentes
- **Estilos**: Modificar los archivos SCSS y Tailwind
- **Configuración**: Ajustar Capacitor, Ionic y otros frameworks
- **Funcionalidades**: Agregar nuevas características según tus necesidades

## Integración Automática

El generador actualiza automáticamente:
- **Workspace Nx**: La aplicación se integra en el workspace
- **Build system**: Configuración completa de build y serve
- **Testing**: Configuración de Jest y pruebas
- **Linting**: Configuración de ESLint

## Notas de Desarrollo

- **Standalone Components**: Todos los componentes usan Angular standalone
- **Ionic Framework**: Configuración optimizada para Ionic
- **Angular Elements**: Soporte completo para Web Components
- **Capacitor**: Configuración para desarrollo móvil
- **Tailwind + DaisyUI**: Sistema de estilos moderno y flexible

## Troubleshooting

### Error: "Cannot find module"
- Verificar que las dependencias estén instaladas
- Ejecutar `npm install` en el directorio raíz

### Error: "Build failed"
- Verificar que la configuración de TypeScript sea correcta
- Comprobar que los archivos de configuración estén presentes

### Angular Elements no funciona
- Verificar que `main-elements.ts` esté configurado correctamente
- Comprobar que el build de elements se ejecute sin errores

## Próximas Mejoras

- **Generación de páginas**: Crear páginas adicionales automáticamente
- **Configuración de PWA**: Soporte para Progressive Web Apps
- **Testing E2E**: Configuración de Cypress o Playwright
- **CI/CD**: Configuración de pipelines de integración continua
