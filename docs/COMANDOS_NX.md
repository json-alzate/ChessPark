# Comandos Nx para Generación de Elementos Angular

Este documento contiene los comandos más utilizados para generar elementos de Angular en el workspace de ChessPark usando Nx.

## 📋 Índice
- [Componentes](#componentes)
- [Servicios](#servicios)
- [Directivas](#directivas)
- [Guards](#guards)
- [Pipes](#pipes)
- [Interceptors](#interceptors)
- [Interfaces y Clases](#interfaces-y-clases)
- [Páginas Ionic](#páginas-ionic)
- [Generador Personalizado](#generador-personalizado)
- [Aplicaciones y Librerías](#aplicaciones-y-librerías)
- [Testing](#testing)

## 🧩 Componentes

### Generar componente con Angular CLI
```bash
npx nx generate @schematics/angular:component nombre-componente --project=nombre-proyecto
```

### Generar componente con Nx Angular
```bash
npx nx generate @nx/angular:component nombre-componente --project=nombre-proyecto
```

### Generar componente Ionic
```bash
npx nx generate @ionic/angular-toolkit:component nombre-componente --project=nombre-proyecto
```

### Opciones adicionales para componentes
```bash
# Componente standalone
npx nx generate @nx/angular:component nombre-componente --project=nombre-proyecto --standalone

# Componente con inline template y styles
npx nx generate @nx/angular:component nombre-componente --project=nombre-proyecto --inline-template --inline-style

# Componente sin archivos de test
npx nx generate @nx/angular:component nombre-componente --project=nombre-proyecto --skip-tests

# Componente en una carpeta específica
npx nx generate @nx/angular:component components/nombre-componente --project=nombre-proyecto
```

## 🔧 Servicios

### Generar servicio
```bash
npx nx generate @schematics/angular:service services/nombre-servicio --project=nombre-proyecto
```

### Con Nx Angular
```bash
npx nx generate @nx/angular:service services/nombre-servicio --project=nombre-proyecto
```

## 📏 Directivas

### Generar directiva
```bash
npx nx generate @schematics/angular:directive directives/nombre-directiva --project=nombre-proyecto
```

### Con Nx Angular
```bash
npx nx generate @nx/angular:directive directives/nombre-directiva --project=nombre-proyecto
```

## 🛡️ Guards

### Generar guard
```bash
npx nx generate @schematics/angular:guard guards/nombre-guard --project=nombre-proyecto
```

### Tipos de guards disponibles
```bash
# Guard con CanActivate
npx nx generate @schematics/angular:guard guards/auth-guard --project=nombre-proyecto --implements CanActivate

# Guard con CanLoad
npx nx generate @schematics/angular:guard guards/feature-guard --project=nombre-proyecto --implements CanLoad

# Guard con CanDeactivate
npx nx generate @schematics/angular:guard guards/unsaved-changes-guard --project=nombre-proyecto --implements CanDeactivate
```

## 🚰 Pipes

### Generar pipe
```bash
npx nx generate @schematics/angular:pipe pipes/nombre-pipe --project=nombre-proyecto
```

### Con Nx Angular
```bash
npx nx generate @nx/angular:pipe pipes/nombre-pipe --project=nombre-proyecto
```

## 🔌 Interceptors

### Generar interceptor
```bash
npx nx generate @schematics/angular:interceptor interceptors/nombre-interceptor --project=nombre-proyecto
```

## 📝 Interfaces y Clases

### Generar interface
```bash
npx nx generate @schematics/angular:interface models/nombre-interface --project=nombre-proyecto
```

### Generar clase
```bash
npx nx generate @schematics/angular:class models/nombre-clase --project=nombre-proyecto
```

### Generar enum
```bash
npx nx generate @schematics/angular:enum enums/nombre-enum --project=nombre-proyecto
```

## 📱 Páginas Ionic

### Generar página Ionic
```bash
npx nx generate @ionic/angular-toolkit:page pages/nombre-pagina --project=nombre-proyecto
```

## 🎯 Generador Personalizado - ChessPark

Este workspace tiene un generador personalizado que facilita la creación de elementos Angular:

### Generar elemento Angular (componente, servicio, guard, directiva, pipe)
```bash
npx nx generate @chesspark/custom-generators:create-angular-element
```

Este generador te permitirá seleccionar:
- Tipo de elemento (component, service, guard, directive, pipe)
- Proyecto donde generarlo
- Nombre del elemento
- Opciones adicionales específicas de cada tipo

## 🏗️ Aplicaciones y Librerías

### Generar nueva aplicación Angular
```bash
npx nx generate @nx/angular:application nombre-app
```

### Generar nueva librería
```bash
npx nx generate @nx/angular:library nombre-lib
```

### Generar aplicación completa con configuración ChessPark
```bash
npx nx generate @chesspark/custom-generators:create-app
```

## 🧪 Testing

### Generar test de componente Cypress
```bash
npx nx generate @nx/angular:component-test nombre-componente --project=nombre-proyecto
```

### Configurar Cypress para un proyecto
```bash
npx nx generate @nx/cypress:configuration --project=nombre-proyecto-e2e
```

## 📂 Estructura de Proyectos

### Aplicaciones disponibles:
- `chessColate` - Aplicación principal de ajedrez
- `chessGrid` - Aplicación de grid de ajedrez

### Librerías disponibles:
- `@chesspark/board` - Componentes y lógica del tablero
- `common-utils` - Utilidades compartidas
- `models` - Modelos de datos
- `state` - Gestión de estado
- `widgets` - Componentes widget

## 💡 Consejos Útiles

1. **Siempre especifica el proyecto**: Usa `--project=nombre-proyecto` para generar elementos en el proyecto correcto.

2. **Usa el generador interactivo**: Ejecuta `npx nx generate` sin parámetros para ver el menú interactivo.

3. **Revisa las opciones**: Usa `--help` en cualquier comando para ver todas las opciones disponibles:
   ```bash
   npx nx generate @nx/angular:component --help
   ```

4. **Generadores en serie**: Puedes combinar múltiples generadores para crear estructuras completas.

5. **Dry run**: Usa `--dry-run` para ver qué archivos se crearán sin ejecutar realmente el comando:
   ```bash
   npx nx generate @nx/angular:component test-component --project=chessColate --dry-run
   ```

## 🔄 Comandos de Ejecución

Después de generar elementos, usa estos comandos para ejecutar tareas:

```bash
# Ejecutar aplicación en desarrollo
npx nx serve nombre-proyecto

# Construir para producción
npx nx build nombre-proyecto

# Ejecutar tests
npx nx test nombre-proyecto

# Ejecutar linting
npx nx lint nombre-proyecto

# Ver todas las tareas disponibles
npx nx show project nombre-proyecto
```

---

**Nota**: Reemplaza `nombre-proyecto` con el nombre real del proyecto donde quieres generar los elementos (chessColate, chessGrid, etc.).