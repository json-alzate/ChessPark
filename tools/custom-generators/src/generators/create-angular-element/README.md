# Generador de Elementos Angular

Este generador permite crear elementos Angular (componentes, servicios, guards, directivas y pipes) en aplicaciones o librerías del monorepo.

## Uso

```bash
nx g @chesspark/custom-generators:create-angular-element
```

O con opciones específicas:

```bash
nx g @chesspark/custom-generators:create-angular-element --projectType=app --projectName=chessColate --elementType=component --name=user-profile --path=pages/profile/
```

## Opciones

- **projectType**: `app` | `lib` - Especifica si generar en una aplicación o librería
- **projectName**: Nombre del proyecto donde generar el elemento
- **elementType**: `component` | `service` | `guard` | `directive` | `pipe` - Tipo de elemento a generar
- **name**: Nombre del elemento
- **path**: Ruta relativa dentro del proyecto (opcional)
- **standalone**: `true` | `false` - Solo para componentes, indica si es standalone (por defecto: true)
- **skipTests**: `true` | `false` - Omitir archivos de test (por defecto: false)

## Ejemplos

### Generar un componente en una aplicación
```bash
nx g @chesspark/custom-generators:create-angular-element --projectType=app --projectName=chessColate --elementType=component --name=user-profile --path=pages/profile/
```

Esto creará:
- `apps/chessColate/src/app/pages/profile/user-profile.component.ts`
- `apps/chessColate/src/app/pages/profile/user-profile.component.html`
- `apps/chessColate/src/app/pages/profile/user-profile.component.scss`
- `apps/chessColate/src/app/pages/profile/user-profile.component.spec.ts`

### Generar un servicio en una librería
```bash
nx g @chesspark/custom-generators:create-angular-element --projectType=lib --projectName=common-utils --elementType=service --name=api-client --path=services/
```

Esto creará:
- `libs/common-utils/src/lib/services/api-client.service.ts`
- `libs/common-utils/src/lib/services/api-client.service.spec.ts`

### Generar un guard
```bash
nx g @chesspark/custom-generators:create-angular-element --projectType=app --projectName=chessColate --elementType=guard --name=auth --path=guards/
```

## Características

- ✅ Soporte para Angular 19+ con sintaxis moderna
- ✅ Componentes standalone por defecto
- ✅ Guards funcionales (CanActivateFn)
- ✅ Pipes y directivas standalone
- ✅ Archivos de test automáticos
- ✅ Validación de tipos de proyecto
- ✅ Rutas automáticas según el tipo de proyecto

## Estructura de archivos generados

### Componente
- `[name].component.ts` - Clase del componente
- `[name].component.html` - Template
- `[name].component.scss` - Estilos
- `[name].component.spec.ts` - Tests (opcional)

### Servicio
- `[name].service.ts` - Clase del servicio
- `[name].service.spec.ts` - Tests (opcional)

### Guard
- `[name].guard.ts` - Guard funcional
- `[name].guard.spec.ts` - Tests (opcional)

### Directiva
- `[name].directive.ts` - Clase de la directiva
- `[name].directive.spec.ts` - Tests (opcional)

### Pipe
- `[name].pipe.ts` - Clase del pipe
- `[name].pipe.spec.ts` - Tests (opcional)
