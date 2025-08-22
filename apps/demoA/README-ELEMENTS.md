# DemoA Angular Elements

Esta guía explica cómo compilar y usar la aplicación DemoA como Angular Elements para integrarla en aplicaciones móviles nativas (Android/iOS) a través de WebView.

## ¿Qué es Angular Elements?

Angular Elements permite convertir componentes Angular en elementos personalizados (Custom Elements) que pueden ser utilizados en cualquier aplicación web, incluyendo WebViews de aplicaciones móviles nativas.

## Compilación

### 1. Compilar para Angular Elements

```bash
# Compilar en modo desarrollo
nx run demoA:build-elements:development

# Compilar en modo producción (recomendado)
nx run demoA:build-elements:production
```

### 2. Servir para desarrollo

```bash
# Servir en modo desarrollo
nx run demoA:serve-elements:development

# Servir en modo producción
nx run demoA:serve-elements:production
```

## Archivos Generados

Después de la compilación, encontrarás los archivos en `dist/apps/demoA-elements/`:

- `index.html` - Página HTML principal
- `main.js` - Script principal con Angular Elements
- `assets/` - Recursos estáticos (imágenes, iconos, etc.)
- Otros archivos CSS y JS necesarios

## Integración en Aplicaciones Móviles

### Android (WebView)

```java
// En tu Activity o Fragment
WebView webView = findViewById(R.id.webview);
webView.getSettings().setJavaScriptEnabled(true);
webView.getSettings().setDomStorageEnabled(true);
webView.getSettings().setAllowFileAccess(true);

// Cargar el archivo HTML
webView.loadUrl("file:///android_asset/demoA-elements/index.html");
```

### iOS (WKWebView)

```swift
// En tu ViewController
let webView = WKWebView()
webView.configuration.preferences.javaScriptEnabled = true

// Cargar el archivo HTML
if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "demoA-elements") {
    webView.loadFileURL(url, allowingReadAccessTo: url)
}
```

### HTML Mínimo para WebView

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DemoA App</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@ionic/core/css/ionic.bundle.css">
</head>
<body>
    <demo-a-app></demo-a-app>
    <script src="main.js" type="module"></script>
</body>
</html>
```

## Comunicación con la Aplicación Nativa

### Desde JavaScript hacia Nativo

```javascript
// En tu aplicación Angular Elements
function sendToNative(data) {
    // Para Android
    if (window.Android) {
        window.Android.receiveData(JSON.stringify(data));
    }
    
    // Para iOS
    if (window.webkit && window.webkit.messageHandlers) {
        window.webkit.messageHandlers.nativeHandler.postMessage(data);
    }
}
```

### Desde Nativo hacia JavaScript

```javascript
// En tu aplicación Angular Elements
window.receiveFromNative = function(data) {
    // Procesar datos recibidos desde la aplicación nativa
    console.log('Datos recibidos:', data);
    // Aquí puedes actualizar el estado de tu aplicación Angular
};
```

## Configuración de Android

```java
// En tu WebView
webView.addJavascriptInterface(new WebAppInterface(this), "Android");

public class WebAppInterface {
    Context mContext;

    WebAppInterface(Context c) {
        mContext = c;
    }

    @JavascriptInterface
    public void receiveData(String data) {
        // Procesar datos recibidos desde Angular Elements
        Log.d("WebApp", "Datos recibidos: " + data);
    }
}
```

## Configuración de iOS

```swift
// En tu WKWebView
let contentController = WKUserContentController()
contentController.add(self, name: "nativeHandler")
webView.configuration.userContentController = contentController

// Implementar WKScriptMessageHandler
extension ViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "nativeHandler" {
            // Procesar datos recibidos desde Angular Elements
            print("Datos recibidos:", message.body)
        }
    }
}
```

## Características Especiales

### 1. Ionic Framework
La aplicación utiliza Ionic Framework, por lo que tendrás acceso a:
- Componentes UI nativos
- Navegación entre páginas
- Gestos táctiles
- Adaptación automática a diferentes tamaños de pantalla

### 2. NgRx State Management
La aplicación incluye gestión de estado con NgRx, permitiendo:
- Manejo centralizado del estado
- Efectos para operaciones asíncronas
- DevTools para debugging

### 3. Componentes Xerpa UI
Incluye componentes personalizados de la librería Xerpa UI:
- Badges, botones, cards
- Carousels, listas, loading
- Componentes específicos para metas financieras

## Solución de Problemas

### Error: "Custom element not defined"
- Asegúrate de que `main.js` se cargue correctamente
- Verifica que no haya errores en la consola del navegador

### Error: "Zone.js is required"
- Asegúrate de que `zone.js` esté incluido en los polyfills

### Problemas de CORS en WebView
- Para Android: `webView.getSettings().setAllowFileAccess(true)`
- Para iOS: Configurar `allowingReadAccessTo` correctamente

### Problemas de rendimiento
- Usa el modo producción para mejor rendimiento
- Considera usar Service Workers para cache
- Optimiza las imágenes y recursos

## Ejemplo Completo

Puedes ver un ejemplo completo en `src/demo-elements-usage.html` que muestra cómo usar el elemento personalizado en una página web normal.

## Notas Importantes

1. **Tamaño del Bundle**: Angular Elements puede generar archivos grandes. Considera usar lazy loading para optimizar.

2. **Compatibilidad**: Angular Elements funciona en navegadores modernos que soporten Custom Elements.

3. **Polyfills**: Asegúrate de incluir los polyfills necesarios para navegadores antiguos.

4. **Testing**: Prueba la integración en dispositivos reales, no solo en emuladores.

5. **Actualizaciones**: Cuando actualices la aplicación Angular, recompila los elementos para obtener los cambios. 