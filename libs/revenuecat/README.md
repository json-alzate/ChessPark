# @chesspark/revenuecat

Librería Angular para integrar RevenueCat en aplicaciones móviles (Android e iOS) usando Capacitor. Permite gestionar suscripciones recurrentes y compras únicas (donaciones) de manera unificada.

## Introducción

RevenueCat es una plataforma que simplifica la gestión de suscripciones y compras in-app. Esta librería proporciona una abstracción unificada para trabajar con RevenueCat en aplicaciones Angular con Capacitor.

### Ventajas de usar RevenueCat

- **Una fuente de verdad**: Sincroniza el estado de suscripciones entre iOS y Android
- **Validación automática**: Valida todas las compras en servidores de RevenueCat
- **Sincronización multiplataforma**: Los usuarios pueden usar la misma suscripción en diferentes dispositivos
- **Análisis detallado**: Dashboard con métricas de ingresos y conversiones
- **Manejo automático**: Gestiona renovaciones, cancelaciones y problemas de facturación

### Casos de Uso

- **Donaciones**: Compras únicas sin renovación automática
- **Suscripciones recurrentes**: Pagos mensuales, anuales, etc.
- **Contenido premium**: Acceso a funcionalidades basado en entitlements

## Instalación

### 1. Instalar el plugin de Capacitor

```bash
npm install @revenuecat/purchases-capacitor
```

### 2. Sincronizar plugins nativos

```bash
npx cap sync
```

### 3. Importar la librería

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';
```

## Configuración Inicial

### Configuración en RevenueCat Dashboard

1. Crear cuenta en [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Crear un nuevo proyecto para tu aplicación
3. Obtener la API Key pública (disponible en Project Settings > API Keys)

### Configuración iOS

1. **Habilitar In-App Purchase en Xcode:**
   - Abrir el proyecto en Xcode
   - Seleccionar el target de la app
   - Ir a "Signing & Capabilities"
   - Hacer clic en "+ Capability"
   - Agregar "In-App Purchase"

2. **Obtener App-Specific Shared Secret:**
   - Ir a [App Store Connect](https://appstoreconnect.apple.com/)
   - Seleccionar "My Apps" > [Tu App]
   - Ir a "App Information" en el menú lateral
   - En la sección "App-Specific Shared Secret", hacer clic en "Manage"
   - Generar una nueva clave y copiarla

3. **Configurar en RevenueCat Dashboard:**
   - En RevenueCat Dashboard, ir a "Apps" > "Add App"
   - Seleccionar "App Store"
   - Ingresar:
     - **App-Specific Shared Secret**: La clave generada anteriormente
     - **App Bundle ID**: El Bundle ID de tu app (ej: `com.tuapp.bundleid`)
     - **App Name**: Nombre de tu aplicación

### Configuración Android

1. **Configurar Google Play Billing:**
   - Ir a [Google Play Console](https://play.google.com/console)
   - Seleccionar tu app
   - Ir a "Monetization setup" > "Products" > "In-app products" o "Subscriptions"
   - Crear los productos que necesites

2. **Obtener credenciales de servicio:**
   - En Google Play Console, ir a "Setup" > "API access"
   - Crear o usar un proyecto de servicio existente
   - Descargar el archivo JSON de credenciales

3. **Configurar en RevenueCat Dashboard:**
   - En RevenueCat Dashboard, ir a "Apps" > "Add App"
   - Seleccionar "Google Play"
   - Subir el archivo JSON de credenciales de servicio
   - Ingresar el **Package Name** de tu app (ej: `com.tuapp.packagename`)

## Uso Básico

### Inicialización

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';
import { Component, OnInit, inject } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private revenueCat = inject(RevenueCatService);

  async ngOnInit() {
    // Inicializar con API Key pública
    await this.revenueCat.initialize('tu_api_key_publica');
    
    // Opcional: Configurar usuario único para sincronización multiplataforma
    // Usa el mismo user ID en todas las plataformas
    const userId = 'user_12345'; // Por ejemplo, el UID de Firebase Auth
    await this.revenueCat.configure(userId);
  }
}
```

### Obtener Productos Disponibles

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';

constructor(private revenueCat: RevenueCatService) {}

async loadProducts() {
  try {
    // Obtener offerings (agrupaciones de productos)
    const offerings = await this.revenueCat.getOfferings();

    if (offerings.current) {
      // Obtener productos disponibles
      const packages = offerings.current.availablePackages;
      
      // packages contiene productos de donación y suscripción
      packages.forEach(pkg => {
        console.log('Producto:', pkg.identifier);
        console.log('Título:', pkg.product.title);
        console.log('Precio:', pkg.product.priceString);
        console.log('Tipo:', pkg.packageType);
      });

      // Acceder a packages específicos
      if (offerings.current.monthly) {
        console.log('Suscripción mensual:', offerings.current.monthly.product.priceString);
      }
      
      if (offerings.current.annual) {
        console.log('Suscripción anual:', offerings.current.annual.product.priceString);
      }
    }
  } catch (error) {
    console.error('Error al obtener productos:', error);
  }
}
```

### Realizar una Compra (Donación o Suscripción)

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';
import { Package, PurchasesError, PURCHASES_ERROR_CODE } from '@chesspark/revenuecat';

constructor(private revenueCat: RevenueCatService) {}

async purchaseProduct(packageToPurchase: Package) {
  try {
    const purchaseResult = await this.revenueCat.purchasePackage(packageToPurchase);
    
    // Verificar si el usuario tiene acceso premium
    if (purchaseResult.customerInfo.entitlements.active['premium']) {
      console.log('Compra exitosa! Usuario tiene acceso premium');
      // Actualizar UI, mostrar contenido premium, etc.
    }
  } catch (error) {
    if (error instanceof PurchasesError) {
      switch (error.code) {
        case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED:
          console.log('Usuario canceló la compra');
          break;
        case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED:
          console.log('Compras no permitidas en este dispositivo');
          break;
        case PURCHASES_ERROR_CODE.NETWORK_ERROR:
          console.log('Error de red. Verifica tu conexión.');
          break;
        default:
          console.error('Error en compra:', error.message);
      }
    } else {
      console.error('Error desconocido:', error);
    }
  }
}
```

### Verificar Estado de Suscripción

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';

constructor(private revenueCat: RevenueCatService) {}

async checkPremiumAccess() {
  try {
    // Verificar si el usuario tiene un entitlement activo
    const isSubscribed = await this.revenueCat.isSubscribed('premium');

    if (isSubscribed) {
      console.log('Usuario tiene acceso premium');
      // Mostrar contenido premium
    } else {
      console.log('Usuario no tiene suscripción activa');
      // Mostrar opciones de compra
    }

    // Obtener información completa del cliente
    const customerInfo = await this.revenueCat.getCustomerInfo();
    const activeEntitlements = customerInfo.entitlements.active;
    
    // Verificar entitlements específicos
    Object.keys(activeEntitlements).forEach(entitlementId => {
      const entitlement = activeEntitlements[entitlementId];
      if (entitlement.isActive) {
        console.log(`Entitlement ${entitlementId} está activo hasta ${entitlement.expirationDate}`);
      }
    });
  } catch (error) {
    console.error('Error al verificar suscripción:', error);
  }
}
```

### Restaurar Compras

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';

constructor(private revenueCat: RevenueCatService) {}

async restorePurchases() {
  try {
    const customerInfo = await this.revenueCat.restorePurchases();
    console.log('Compras restauradas:', customerInfo);
    
    // Verificar si hay entitlements activos después de restaurar
    const hasPremium = customerInfo.entitlements.active['premium']?.isActive;
    if (hasPremium) {
      // Actualizar UI para mostrar contenido premium
    }
  } catch (error) {
    console.error('Error al restaurar compras:', error);
  }
}
```

### Escuchar Cambios en el Estado del Cliente

```typescript
import { RevenueCatService } from '@chesspark/revenuecat';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-premium',
  templateUrl: './premium.component.html',
})
export class PremiumComponent implements OnInit, OnDestroy {
  private revenueCat = inject(RevenueCatService);
  private subscription?: Subscription;
  isPremium = false;

  ngOnInit() {
    // Escuchar cambios en el estado del cliente
    this.subscription = this.revenueCat.customerInfoUpdates$.subscribe(customerInfo => {
      // El estado del cliente ha cambiado (nueva compra, renovación, cancelación, etc.)
      const isPremium = customerInfo.entitlements.active['premium']?.isActive;
      this.isPremium = isPremium || false;
      
      // Actualizar UI
      if (isPremium) {
        console.log('Usuario ahora tiene acceso premium');
      } else {
        console.log('Usuario perdió acceso premium');
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
```

## Configuración de Productos en RevenueCat

### Crear Productos

1. **En App Store Connect / Google Play Console:**
   - Crear los productos in-app que necesites
   - Para donaciones: usar productos "Non-consumable" o "Consumable"
   - Para suscripciones: usar productos "Subscription"
   - Anotar los identificadores de producto (deben ser únicos)

2. **En RevenueCat Dashboard:**
   - Ir a "Products"
   - Hacer clic en "Add Product"
   - Ingresar el identificador del producto (debe coincidir con App Store/Play Store)
   - Seleccionar el tipo de producto
   - Guardar

### Crear Entitlements

1. En RevenueCat Dashboard, ir a "Entitlements"
2. Hacer clic en "Add Entitlement"
3. Ingresar un identificador (ej: `premium`)
4. Asignar los productos que otorgan este entitlement
5. Guardar

### Crear Offerings

1. En RevenueCat Dashboard, ir a "Offerings"
2. Hacer clic en "Add Offering"
3. Ingresar un identificador (ej: `default`)
4. Agregar packages al offering:
   - Hacer clic en "Add Package"
   - Seleccionar un identificador de package (ej: `monthly`, `annual`, `donation_5`)
   - Seleccionar el producto asociado
   - Guardar
5. Marcar el offering como "Current" si quieres que sea el ofrecido por defecto

## Manejo de Errores

La librería proporciona errores tipados para facilitar el manejo:

```typescript
import { PurchasesError, PURCHASES_ERROR_CODE } from '@chesspark/revenuecat';

try {
  await this.revenueCat.purchasePackage(packageToPurchase);
} catch (error) {
  if (error instanceof PurchasesError) {
    switch (error.code) {
      case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED:
        // Usuario canceló la compra
        this.showMessage('Compra cancelada');
        break;
        
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED:
        // Compras no permitidas (ej: restricciones parentales)
        this.showMessage('Las compras no están permitidas en este dispositivo');
        break;
        
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID:
        // Producto no válido
        this.showMessage('El producto seleccionado no es válido');
        break;
        
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        // Error de red
        this.showMessage('Error de conexión. Verifica tu internet.');
        break;
        
      case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE:
        // Producto no disponible
        this.showMessage('Este producto no está disponible en este momento');
        break;
        
      case PURCHASES_ERROR_CODE.INVALID_CREDENTIALS:
        // Credenciales inválidas
        console.error('API Key de RevenueCat inválida');
        break;
        
      default:
        console.error('Error desconocido:', error.message);
        this.showMessage('Ocurrió un error. Por favor intenta de nuevo.');
    }
  } else {
    console.error('Error inesperado:', error);
  }
}
```

## Testing

### Sandbox Testing

**iOS:**
- Usar un sandbox tester creado en App Store Connect
- Iniciar sesión con la cuenta sandbox en el dispositivo
- Las compras en sandbox no son reales
- Los períodos de suscripción se aceleran (1 mes = 5 minutos)

**Android:**
- Usar licencias de prueba en Google Play Console
- Agregar cuentas de prueba en Google Play Console > Settings > License testing
- Las compras de prueba no son reales

### Consideraciones de Testing

- Las compras en sandbox no son reales y no generan ingresos
- Los períodos de suscripción se aceleran para facilitar pruebas
- Usar cuentas de prueba específicas (no cuentas reales)
- Verificar que los productos estén configurados correctamente antes de probar

## Mejores Prácticas

1. **Inicializar temprano**: Inicializa RevenueCat en el inicio de la app (por ejemplo, en `AppComponent.ngOnInit()`)

2. **Identificadores de usuario consistentes**: Usa el mismo user ID en todas las plataformas para sincronización. Por ejemplo, el UID de Firebase Auth.

3. **Verificar entitlements, no productos**: Siempre verifica entitlements para determinar acceso, no solo si un producto fue comprado.

4. **Manejo robusto de errores**: Implementa manejo de errores completo para todas las operaciones de compra.

5. **Proporcionar opción de restaurar**: Siempre ofrece una opción para restaurar compras, especialmente útil cuando el usuario cambia de dispositivo.

6. **Logging en desarrollo**: Usa `setLogLevel(LogLevel.DEBUG)` en desarrollo para debugging:

```typescript
// En desarrollo
if (!environment.production) {
  this.revenueCat.setLogLevel(LogLevel.DEBUG);
}
```

7. **Escuchar cambios de estado**: Usa `customerInfoUpdates$` para reaccionar automáticamente a cambios en el estado de suscripción.

8. **No almacenar información sensible**: RevenueCat maneja toda la información de compras de forma segura. No necesitas almacenar tokens o recibos localmente.

## Troubleshooting

### Problema: "Producto no encontrado"

**Soluciones:**
- Verificar que el producto esté creado en App Store Connect/Google Play Console
- Verificar que el producto esté asignado al entitlement en RevenueCat Dashboard
- Verificar que el producto esté en un offering activo
- Verificar que el identificador del producto coincida exactamente en todas las plataformas

### Problema: "API Key no válida"

**Soluciones:**
- Verificar que estés usando la API Key pública (no la privada)
- Verificar que la API Key corresponda al proyecto correcto en RevenueCat
- Verificar que la API Key esté correctamente copiada (sin espacios adicionales)

### Problema: "Compras no se sincronizan"

**Soluciones:**
- Verificar conexión a internet
- Verificar que RevenueCat tenga acceso a App Store Connect/Google Play Console
- Verificar que el user ID sea consistente entre plataformas
- Intentar llamar a `syncPurchases()` manualmente

### Problema: "RevenueCat no está disponible"

**Soluciones:**
- Verificar que estés ejecutando en un dispositivo nativo (no en el navegador)
- Verificar que el plugin de Capacitor esté correctamente instalado: `npx cap sync`
- Verificar que estés usando la versión correcta del plugin

### Problema: "Error al inicializar"

**Soluciones:**
- Verificar que la API Key sea correcta
- Verificar que la app esté correctamente configurada en RevenueCat Dashboard
- Verificar que las plataformas (iOS/Android) estén correctamente configuradas
- Revisar los logs con `setLogLevel(LogLevel.DEBUG)`

## Configuración de Capacitor

Actualiza `capacitor.config.ts` si necesitas configuración adicional:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuapp.bundleid',
  appName: 'Tu App',
  webDir: 'dist',
  plugins: {
    // RevenueCat se configura automáticamente
    // No requiere configuración adicional aquí
  },
};

export default config;
```

## Referencias

- [Documentación oficial de RevenueCat](https://docs.revenuecat.com/)
- [Documentación del plugin Capacitor](https://docs.revenuecat.com/docs/capacitor)
- [RevenueCat Dashboard](https://app.revenuecat.com/)
- [Guía de integración iOS](https://docs.revenuecat.com/docs/ios)
- [Guía de integración Android](https://docs.revenuecat.com/docs/android)

## Licencia

MIT

## Soporte

Para reportar bugs o solicitar funcionalidades, abre un issue en el repositorio del proyecto.
