# Guía de Migración a @chesspark/common-utils

Esta guía te ayudará a migrar tu código existente para usar la nueva librería de utilidades comunes.

## 🚀 Instalación

Primero, instala la librería en tu proyecto:

```bash
npm install @chesspark/common-utils
```

## 🔄 Migración del Servicio de Confetti

### Antes (código actual en chessCoordinatesTrainer)

```typescript
import confetti from 'canvas-confetti';

// ... código del componente ...

private launchConfetti(color: 'w' | 'b', recordType: 'color' | 'overall' | 'both') {
  // Configuración del confetti según el color
  let confettiColors: string[];
  
  if (recordType === 'overall' || recordType === 'both') {
    // Para récords generales, usar colores dorados
    confettiColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
  } else {
    // Para récords por color, usar tonos del color correspondiente
    confettiColors = color === 'w' 
      ? ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'] // Tonos blancos
      : ['#000000', '#1a1a1a', '#333333', '#4d4d4d']; // Tonos negros
  }

  // Lanzar confetti desde múltiples posiciones
  const duration = recordType === 'both' ? 5000 : 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { 
    startVelocity: 30, 
    spread: 360, 
    ticks: 60, 
    zIndex: 0,
    colors: confettiColors
  };

  // ... resto del código de confetti ...
}
```

### Después (usando la librería)

```typescript
import { ConfettiService } from '@chesspark/common-utils';

// ... código del componente ...

constructor(private confettiService: ConfettiService) {}

private launchConfetti(color: 'w' | 'b', recordType: 'color' | 'overall' | 'both') {
  if (recordType === 'overall' || recordType === 'both') {
    // Para récords generales, usar tema dorado
    this.confettiService.launchTheme('gold', { 
      duration: recordType === 'both' ? 5000 : 3000 
    });
  } else {
    // Para récords por color, usar colores personalizados
    const colors = color === 'w' 
      ? ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'] // Tonos blancos
      : ['#000000', '#1a1a1a', '#333333', '#4d4d4d']; // Tonos negros
    
    this.confettiService.launch(colors, 3000, 'medium');
  }
}
```

## 📱 Migración del Sistema de Notificaciones

### Antes (sin sistema de notificaciones)

```typescript
// Mostrar mensajes usando alert o console
alert('¡Nuevo récord!');
console.log('Puntuación guardada');
```

### Después (usando NotificationService)

```typescript
import { NotificationService } from '@chesspark/common-utils';

constructor(private notificationService: NotificationService) {}

// Mostrar notificaciones
this.notificationService.success('¡Nuevo récord!', 'Has superado tu mejor puntuación');
this.notificationService.info('Puntuación guardada', 'Tu progreso ha sido guardado');
```

## 📅 Migración de Utilidades de Fecha

### Antes (usando date-fns)

```typescript
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const timeAgo = formatDistanceToNow(new Date(timestamp), { 
  locale: es, 
  addSuffix: true 
});
```

### Después (usando DateUtilsService)

```typescript
import { DateUtilsService } from '@chesspark/common-utils';

constructor(private dateUtils: DateUtilsService) {}

const timeAgo = this.dateUtils.getRelativeTime(timestamp);
```

## 💾 Migración del Almacenamiento

### Antes (usando StorageService personalizado)

```typescript
// En chessCoordinatesTrainer ya tienes un StorageService
// Puedes migrar gradualmente o mantener ambos
```

### Después (usando StorageService de la librería)

```typescript
import { StorageService } from '@chesspark/common-utils';

constructor(private storage: StorageService) {}

// Guardar datos con encriptación y TTL
this.storage.set('user-stats', stats, { 
  encrypt: true, 
  ttl: 24 * 60 * 60 * 1000 // 24 horas
});

// Obtener datos
const stats = this.storage.get('user-stats', { encrypt: true });
```

## ✅ Migración de Validaciones

### Antes (validaciones manuales)

```typescript
// Validaciones manuales en el código
if (!email || !email.includes('@')) {
  // Mostrar error
}

if (password.length < 8) {
  // Mostrar error
}
```

### Después (usando ValidationService)

```typescript
import { ValidationService } from '@chesspark/common-utils';

constructor(private validation: ValidationService) {}

// Validar email
if (!this.validation.isValidEmail(email)) {
  // Mostrar error
}

// Validar contraseña
if (!this.validation.isValidPassword(password, {
  minLength: 8,
  requireUppercase: true,
  requireNumbers: true
})) {
  // Mostrar error
}
```

## 🔢 Migración de Utilidades Numéricas

### Antes (cálculos manuales)

```typescript
// Cálculos manuales
const accuracy = (correctAnswers / totalAnswers) * 100;
const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
```

### Después (usando NumberUtilsService)

```typescript
import { NumberUtilsService } from '@chesspark/common-utils';

constructor(private numberUtils: NumberUtilsService) {}

const accuracy = this.numberUtils.calculatePercentage(correctAnswers, totalAnswers);
const averageScore = this.numberUtils.average(scores);
```

## 📝 Migración de Utilidades de String

### Antes (manipulación manual de strings)

```typescript
// Manipulación manual
const title = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
const slug = text.toLowerCase().replace(/\s+/g, '-');
```

### Después (usando StringUtilsService)

```typescript
import { StringUtilsService } from '@chesspark/common-utils';

constructor(private stringUtils: StringUtilsService) {}

const title = this.stringUtils.changeCase(text, 'sentence');
const slug = this.stringUtils.toSlug(text);
```

## 🎯 Migración de Utilidades de Objetos

### Antes (clonación manual)

```typescript
// Clonación manual
const clonedObject = JSON.parse(JSON.stringify(originalObject));
```

### Después (usando ObjectUtilsService)

```typescript
import { ObjectUtilsService } from '@chesspark/common-utils';

constructor(private objectUtils: ObjectUtilsService) {}

const clonedObject = this.objectUtils.deepClone(originalObject);
```

## 🔧 Pasos de Migración Recomendados

### 1. Migración Gradual
- No migres todo de una vez
- Comienza con un servicio (ej: ConfettiService)
- Prueba en desarrollo antes de producción

### 2. Orden de Migración Sugerido
1. **ConfettiService** - Reemplaza el código de confetti existente
2. **NotificationService** - Agrega notificaciones donde sea útil
3. **DateUtilsService** - Reemplaza date-fns gradualmente
4. **StorageService** - Migra el almacenamiento existente
5. **ValidationService** - Agrega validaciones robustas
6. **Otros servicios** - Según necesidades específicas

### 3. Testing
- Ejecuta tests después de cada migración
- Verifica que la funcionalidad sea idéntica
- Aprovecha las nuevas características gradualmente

### 4. Limpieza
- Una vez que todo funcione, elimina dependencias obsoletas
- Limpia imports no utilizados
- Actualiza la documentación

## 📚 Ejemplos Completos

### Componente de Coordenadas Migrado

```typescript
import { Component } from '@angular/core';
import { 
  ConfettiService, 
  NotificationService, 
  DateUtilsService,
  StorageService 
} from '@chesspark/common-utils';

@Component({
  selector: 'app-coordinates',
  templateUrl: './coordinates.page.html'
})
export class CoordinatesPage {
  constructor(
    private confettiService: ConfettiService,
    private notificationService: NotificationService,
    private dateUtils: DateUtilsService,
    private storage: StorageService
  ) {}

  onNewRecord(color: 'w' | 'b', recordType: 'color' | 'overall' | 'both') {
    // Lanzar confetti
    if (recordType === 'overall' || recordType === 'both') {
      this.confettiService.launchTheme('gold');
    } else {
      const colors = color === 'w' 
        ? ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0']
        : ['#000000', '#1a1a1a', '#333333', '#4d4d4d'];
      this.confettiService.launch(colors, 3000, 'medium');
    }

    // Mostrar notificación
    this.notificationService.success(
      '¡Nuevo récord!', 
      `Has superado tu mejor puntuación en ${color === 'w' ? 'blancas' : 'negras'}`
    );

    // Guardar estadísticas
    const stats = {
      score: this.score,
      timestamp: Date.now(),
      color,
      recordType
    };
    
    this.storage.set('latest-record', stats, { encrypt: true });
  }

  getTimeAgo(timestamp: number): string {
    return this.dateUtils.getRelativeTime(timestamp);
  }
}
```

## 🆘 Soporte

Si encuentras problemas durante la migración:

1. Revisa los logs de consola
2. Verifica que todos los imports sean correctos
3. Asegúrate de que la librería esté construida correctamente
4. Consulta la documentación de la API
5. Abre un issue en el repositorio si es necesario

## 🎉 Beneficios de la Migración

- **Código más limpio** - Menos código duplicado
- **Mantenimiento más fácil** - Cambios centralizados
- **Nuevas funcionalidades** - Características avanzadas
- **Mejor testing** - Servicios probados y confiables
- **Consistencia** - Mismo comportamiento en toda la app
- **Reutilización** - Fácil de usar en otros proyectos

