# Guía de Estilos UI/UX - ChessColate

Esta guía define los estándares de diseño y estructura para la aplicación ChessColate, asegurando consistencia visual y una experiencia de usuario coherente en toda la aplicación.

## 📋 Tabla de Contenidos

1. [Tema y Configuración](#tema-y-configuración)
2. [Estructura de Páginas](#estructura-de-páginas)
3. [Tipografía](#tipografía)
4. [Colores](#colores)
5. [Componentes DaisyUI](#componentes-daisyui)
6. [Componentes Ionic](#componentes-ionic)
7. [Espaciado y Layout](#espaciado-y-layout)
8. [Estados y Feedback](#estados-y-feedback)
9. [Responsive Design](#responsive-design)

---

## 🎨 Tema y Configuración

### Tema Principal: Halloween

La aplicación utiliza **DaisyUI** con el tema **Halloween** como tema por defecto. Este tema debe aplicarse en todos los contenedores principales.

```html
<div class="main-container" data-theme="halloween">
  <!-- Contenido de la página -->
</div>
```

**Regla importante:** Todas las páginas deben incluir `data-theme="halloween"` en su contenedor principal.

---

## 📄 Estructura de Páginas

### Estructura Base de una Página

Todas las páginas deben seguir esta estructura base:

```html
<ion-content [fullscreen]="true">
  <div class="main-container" data-theme="halloween">
    
    <!-- Navbar (si aplica) -->
    <app-navbar></app-navbar>
    
    <!-- Contenido principal -->
    <div class="container mx-auto px-4 py-6">
      <!-- Título principal de la página -->
      <h2 class="text-2xl font-bold mb-4">
        Título de la Página
      </h2>
      
      <!-- Contenido de la página -->
    </div>
    
  </div>
</ion-content>
```

### Componentes de Página

1. **Navbar**: Debe estar presente en todas las páginas principales (excepto modales)
2. **Contenedor principal**: Usar `main-container` con `data-theme="halloween"`
3. **Contenedor de contenido**: Usar `container mx-auto px-4 py-6` para el contenido principal

---

## ✍️ Tipografía

### Jerarquía de Títulos

#### Título Principal de Página (H2)
- **Clase**: `text-2xl font-bold mb-4`
- **Uso**: Título principal de cada página
- **Ejemplo**:
```html
<h2 class="text-2xl font-bold mb-4">
  Rutinas de entrenamiento
</h2>
```

#### Título de Sección (H3)
- **Clase**: `text-xl font-semibold mb-2`
- **Uso**: Títulos de secciones dentro de una página
- **Ejemplo**:
```html
<h3 class="text-xl font-semibold mb-2">
  Estadísticas
</h3>
```

#### Subtítulo (H4)
- **Clase**: `text-lg font-bold mb-1` o `text-lg mb-1 font-bold`
- **Uso**: Subtítulos y etiquetas de secciones menores
- **Ejemplo**:
```html
<h4 class="text-lg mb-1 font-bold">
  Rutinas de entrenamiento
</h4>
```

#### Título de Card/Item (H6)
- **Clase**: `text-sm text-base-content/70`
- **Uso**: Etiquetas descriptivas en cards o elementos informativos
- **Ejemplo**:
```html
<h6 class="text-sm text-base-content/70">Elo total:</h6>
```

#### Números Destacados (H1)
- **Clase**: `text-4xl font-bold`
- **Uso**: Valores numéricos importantes (como ELO total)
- **Ejemplo**:
```html
<h1 class="text-4xl font-bold">{{ eloTotal }}</h1>
```

### Texto de Contenido

- **Texto normal**: Sin clases específicas, usa el estilo por defecto del tema
- **Texto secundario**: `text-base-content/70` para texto con menor énfasis
- **Texto pequeño**: `text-sm` para información adicional

---

## 🎨 Colores

### Color Principal: ELO Rating

El color **#bf811c** (dorado/naranja) es el color oficial para representar valores de ELO en toda la aplicación.

#### Uso del Color ELO

1. **En gráficos y visualizaciones**:
```typescript
color: '#bf811c'
```

2. **En texto de ELO** (si se requiere):
```html
<span style="color: #bf811c;">1500</span>
```

3. **En badges o indicadores de ELO**:
```html
<div class="badge" style="background-color: #bf811c; color: white;">1500</div>
```

### Colores del Tema Halloween

La aplicación utiliza los colores del tema Halloween de DaisyUI:
- **Primary**: Color primario del tema (naranja/dorado)
- **Base-100**: Fondo de cards y elementos elevados
- **Base-200**: Fondo secundario
- **Base-content**: Color del texto principal

### Clases de Color DaisyUI

- `btn-primary`: Botones principales
- `btn-info`: Botones informativos
- `bg-base-100`: Fondo de cards
- `bg-base-200`: Fondo secundario
- `text-base-content`: Texto principal
- `text-base-content/70`: Texto secundario (70% opacidad)

---

## 🧩 Componentes DaisyUI

### Botones

#### Botón Principal
```html
<button class="btn btn-primary btn-lg w-full">
  Texto del botón
</button>
```

#### Botón Secundario
```html
<button class="btn btn-ghost btn-block">
  Texto del botón
</button>
```

#### Botón Pequeño
```html
<button class="btn btn-sm btn-soft btn-info">
  Texto del botón
</button>
```

#### Variantes de Botones
- `btn-primary`: Botón principal
- `btn-info`: Botón informativo
- `btn-ghost`: Botón sin fondo
- `btn-soft`: Botón con estilo suave
- `btn-sm`: Tamaño pequeño
- `btn-lg`: Tamaño grande
- `btn-block`: Ancho completo
- `w-full`: Ancho completo (clase Tailwind)

### Cards

#### Card Básica
```html
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    <!-- Contenido -->
  </div>
</div>
```

#### Card con Título
```html
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    <h2 class="card-title">Título de la Card</h2>
    <p>Contenido de la card</p>
  </div>
</div>
```

### Badges

#### Badge Estándar
```html
<div class="badge badge-primary">Texto</div>
```

#### Badge Grande
```html
<div class="badge badge-lg badge-primary">1500</div>
```

#### Badge Neutral
```html
<div class="badge badge-neutral">5</div>
```

### Collapse (Acordeones)

```html
<div class="collapse collapse-arrow bg-base-200">
  <input type="checkbox" [checked]="true" />
  <div class="collapse-title text-xl font-medium">
    Título del acordeón
  </div>
  <div class="collapse-content">
    Contenido del acordeón
  </div>
</div>
```

### Tabs

```html
<div class="tabs tabs-boxed justify-center">
  <button class="tab tab-active">Tab 1</button>
  <button class="tab">Tab 2</button>
</div>
```

### Loading/Skeleton

```html
<!-- Spinner de carga -->
<span class="loading loading-spinner loading-sm"></span>

<!-- Skeleton -->
<div class="skeleton h-8 w-3/4"></div>
```

### Navbar

La navbar debe seguir esta estructura:

```html
<div class="navbar">
  <div class="navbar-start">
    <!-- Contenido izquierdo -->
  </div>
  <div class="navbar-end">
    <!-- Contenido derecho -->
  </div>
</div>
```

---

## 📱 Componentes Ionic

### Ion-Content

Todas las páginas deben usar `ion-content` con `[fullscreen]="true"`:

```html
<ion-content [fullscreen]="true">
  <!-- Contenido -->
</ion-content>
```

### Ion-Footer

Para botones fijos en mobile:

```html
<ion-footer class="md:hidden">
  <ion-toolbar>
    <button class="btn btn-primary btn-lg w-full">
      Acción
    </button>
  </ion-toolbar>
</ion-footer>
```

---

## 📐 Espaciado y Layout

### Padding y Márgenes

- **Padding de página**: `p-2` o `px-4 py-6` según el caso
- **Espaciado entre secciones**: `space-y-6` o `mb-4`, `mb-6`
- **Gap en flex**: `gap-1`, `gap-2`, `gap-4` según necesidad

### Contenedores

#### Contenedor Principal
```html
<div class="container mx-auto px-4 py-6">
  <!-- Contenido -->
</div>
```

#### Contenedor con Padding Simple
```html
<div class="p-2">
  <!-- Contenido -->
</div>
```

### Grids

#### Grid Responsive
```html
<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
  <!-- Items -->
</div>
```

### Flexbox

#### Flex Row
```html
<div class="flex flex-row gap-1">
  <!-- Items -->
</div>
```

#### Flex Column
```html
<div class="flex flex-col space-y-4">
  <!-- Items -->
</div>
```

#### Flex con Justificación
```html
<div class="flex items-center justify-between">
  <!-- Items -->
</div>
```

---

## 🔄 Estados y Feedback

### Estados de Carga

#### Loading Spinner
```html
<div class="flex items-center gap-2">
  <span class="loading loading-spinner loading-sm"></span>
  <span class="text-sm text-gray-500">Cargando...</span>
</div>
```

#### Skeleton Loading
```html
<div class="space-y-6">
  <div class="skeleton h-8 w-3/4"></div>
  <div class="skeleton h-12 w-full"></div>
</div>
```

### Estados de Botones

#### Botón Deshabilitado
```html
<button class="btn btn-primary" [disabled]="!isValid">
  Acción
</button>
```

### Indicadores Visuales

#### Badge con Indicador
```html
<div class="indicator">
  <svg><!-- Icono --></svg>
  <span class="badge badge-xs badge-primary indicator-item"></span>
</div>
```

---

## 📱 Responsive Design

### Breakpoints de Tailwind

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px

### Ejemplos de Uso

#### Ocultar en Mobile
```html
<div class="hidden md:block">
  <!-- Contenido solo visible en desktop -->
</div>
```

#### Ocultar en Desktop
```html
<div class="md:hidden">
  <!-- Contenido solo visible en mobile -->
</div>
```

#### Grid Responsive
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Items -->
</div>
```

---

## 📝 Ejemplos Completos

### Ejemplo: Página con Título y Cards

```html
<ion-content [fullscreen]="true">
  <div class="main-container" data-theme="halloween">
    
    <app-navbar></app-navbar>
    
    <div class="container mx-auto px-4 py-6">
      
      <!-- Título principal -->
      <h2 class="text-2xl font-bold mb-4">
        Título de la Página
      </h2>
      
      <!-- Sección -->
      <div class="space-y-4">
        <h3 class="text-xl font-semibold mb-2">
          Sección
        </h3>
        
        <!-- Card -->
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <h6 class="text-sm text-base-content/70">Elo total:</h6>
            <h1 class="text-4xl font-bold" style="color: #bf811c;">1500</h1>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</ion-content>
```

### Ejemplo: Card con ELO

```html
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <div>
        <h6 class="text-sm text-base-content/70">Elo total:</h6>
        <h1 class="text-4xl font-bold" style="color: #bf811c;">{{ eloTotal }}</h1>
      </div>
      <div class="avatar">
        <div class="w-16 rounded">
          <img src="..." alt="..." />
        </div>
      </div>
    </div>
  </div>
</div>
```

### Ejemplo: Botones de Acción

```html
<div class="p-2">
  <div class="flex flex-row gap-1 mt-2 mb-2">
    <button class="btn btn-sm btn-soft btn-info">
      Acción 1
    </button>
    <button class="btn btn-sm btn-soft btn-info flex-1 min-w-0">
      Acción 2
    </button>
  </div>
</div>
```

---

## ✅ Checklist de Implementación

Al crear una nueva página, verifica:

- [ ] Incluye `data-theme="halloween"` en el contenedor principal
- [ ] Usa la estructura base con `ion-content` y `main-container`
- [ ] Incluye el navbar si corresponde
- [ ] Usa los tamaños de título correctos (`text-2xl` para título principal)
- [ ] Aplica el color `#bf811c` para valores de ELO
- [ ] Usa componentes DaisyUI apropiados
- [ ] Implementa estados de carga (skeleton o spinner)
- [ ] Es responsive (oculta/muestra elementos según breakpoint)
- [ ] Usa espaciado consistente (`space-y-6`, `gap-4`, etc.)
- [ ] Sigue la jerarquía de tipografía definida

---

## 🔗 Referencias

- [DaisyUI Documentation](https://daisyui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Ionic Framework Documentation](https://ionicframework.com/docs)

---


**Versión**: 1.0.0
