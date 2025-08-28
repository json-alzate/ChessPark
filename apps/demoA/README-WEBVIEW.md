# DemoA Angular Elements - Versión WebView Optimizada

Esta versión está optimizada específicamente para ser utilizada en WebViews de aplicaciones móviles nativas (Android e iOS).

## Características de la Versión WebView

### ✅ Problemas Solucionados
- **Estilos DaisyUI**: Cargados desde CDN para asegurar compatibilidad
- **Imágenes**: Rutas corregidas y verificación de carga
- **WebView Optimizado**: Configurado para pantalla completa sin elementos de prueba
- **Comunicación Nativa**: APIs preparadas para comunicación con app nativa
- **Performance**: Optimizado para WebView con scroll suave y sin zoom

### 🚀 Cómo Usar

#### 1. Compilar la Aplicación
```bash
nx run demoA:build-elements-enhanced:development
```

#### 2. Archivo HTML para WebView
Usar el archivo `demo-elements-webview.html` en la raíz del proyecto.

#### 3. Integración en App Nativa

##### Android (WebView)
```kotlin
// En tu Activity
webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    allowFileAccess = true
    allowContentAccess = true
}

// Cargar el archivo
webView.loadUrl("file:///android_asset/demo-elements-webview.html")

// Comunicación con JavaScript
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun appReady(data: String) {
        // App está lista
    }
    
    @JavascriptInterface
    fun appError(data: String) {
        // Manejar error
    }
    
    @JavascriptInterface
    fun handleMessage(data: String) {
        // Manejar mensajes de Angular
    }
}, "Android")
```

##### iOS (WKWebView)
```swift
// Configurar WKWebView
let webView = WKWebView()
webView.configuration.userContentController.add(self, name: "appReady")
webView.configuration.userContentController.add(self, name: "appError")
webView.configuration.userContentController.add(self, name: "nativeHandler")

// Cargar el archivo
if let url = Bundle.main.url(forResource: "demo-elements-webview", withExtension: "html") {
    webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
}

// Manejar mensajes
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "appReady":
            // App está lista
            break
        case "appError":
            // Manejar error
            break
        case "nativeHandler":
            // Manejar mensajes de Angular
            break
        default:
            break
        }
    }
}
```

## Estructura de Archivos

```
dist/apps/demoA-elements-enhanced/browser/
├── main.js                    # Script principal
├── polyfills.js              # Polyfills necesarios
├── styles.css                # Estilos compilados
├── assets/                   # Assets de la aplicación
│   ├── images/
│   │   ├── goals/           # Imágenes de metas
│   │   └── rules/           # Imágenes de reglas
│   ├── icon/                # Iconos
│   └── demoXerpa.jpeg       # Logo
└── chunk-*.js               # Chunks de código
```

## Comunicación con App Nativa

### Desde JavaScript hacia Nativo
```javascript
// Enviar mensaje a app nativa
window.sendToNative({
    action: 'navigate',
    route: '/home',
    data: { userId: 123 }
});
```

### Desde Nativo hacia JavaScript
```javascript
// Recibir mensaje de app nativa
window.addEventListener('nativeMessage', function(event) {
    const message = event.detail;
    console.log('Mensaje de app nativa:', message);
});
```

## Optimizaciones Implementadas

### 1. Viewport Configurado
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### 2. Estilos DaisyUI desde CDN
```html
<link href="https://cdn.jsdelivr.net/npm/daisyui@4.7.2/dist/full.min.css" rel="stylesheet" type="text/css" />
```

### 3. Prevención de Zoom
```javascript
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });
```

### 4. Scroll Suave
```css
html, body {
    -webkit-overflow-scrolling: touch;
}
```

### 5. Verificación de Assets
```javascript
// Verificar que las imágenes se carguen correctamente
setTimeout(() => {
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
        img.onload = function() {
            console.log(`✅ Imagen ${index} cargada:`, img.src);
        };
        img.onerror = function() {
            console.error(`❌ Error cargando imagen ${index}:`, img.src);
        };
    });
}, 1000);
```

## Troubleshooting

### Problema: Imágenes no se cargan
**Solución**: Verificar que las rutas en el código Angular usen rutas relativas:
```typescript
// En lugar de
src="assets/images/goals/casa.png"

// Usar
src="./assets/images/goals/casa.png"
```

### Problema: Estilos DaisyUI no aparecen
**Solución**: Los estilos se cargan desde CDN. Si hay problemas de conectividad, considerar incluir DaisyUI en el build.

### Problema: App no se comunica con nativo
**Solución**: Verificar que los handlers estén configurados correctamente en la app nativa.

## Próximos Pasos

1. **Testing en Dispositivos Reales**: Probar en WebViews reales de Android e iOS
2. **Performance**: Monitorear rendimiento y optimizar si es necesario
3. **Offline Support**: Considerar cache de assets para funcionamiento offline
4. **Deep Linking**: Implementar deep linking desde app nativa hacia rutas específicas

## Comandos Útiles

```bash
# Compilar para desarrollo
nx run demoA:build-elements-enhanced:development

# Compilar para producción
nx run demoA:build-elements-enhanced:production

# Servir localmente para pruebas
npx serve dist/apps/demoA-elements-enhanced/browser

# Verificar assets
ls -la dist/apps/demoA-elements-enhanced/browser/assets/
``` 