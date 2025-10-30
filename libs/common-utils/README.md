# @chesspark/common-utils

Una librería Angular completa de utilidades comunes para el proyecto ChessPark.

## 🚀 Características

- **Confetti Service**: Efectos de confetti personalizables para celebraciones
- **Notification Service**: Sistema de notificaciones reactivo
- **Date Utils Service**: Utilidades para manejo de fechas y tiempo
- **Storage Service**: Almacenamiento local con encriptación y TTL
- **Random FEN Service**: Generación de posiciones FEN realistas de ajedrez
- **Elo Calculator Service**: Cálculo de ELO y sistemas de clasificación
- **Uid Generator Service**: Generación de identificadores únicos
- **Random Number Service**: Utilidades para números aleatorios y distribuciones

## 📦 Instalación

```bash
npm install @chesspark/common-utils
```

## 🔧 Uso

### Confetti Service

```typescript
import { ConfettiService } from '@chesspark/common-utils';

constructor(private confettiService: ConfettiService) {}

// Lanzar confetti con tema predefinido
this.confettiService.launchTheme('gold');

// Lanzar confetti personalizado
this.confettiService.launch(
  ['#FFD700', '#FFA500', '#FF6347'],
  3000,
  'high'
);

// Lanzar desde posición específica
this.confettiService.launchFromPosition(0.5, 0.5, ['#FF0000', '#00FF00']);
```

### Notification Service

```typescript
import { NotificationService } from '@chesspark/common-utils';

constructor(private notificationService: NotificationService) {}

// Mostrar notificaciones
this.notificationService.success('¡Éxito!', 'Operación completada');
this.notificationService.error('Error', 'Algo salió mal');
this.notificationService.warning('Advertencia', 'Ten cuidado');
this.notificationService.info('Información', 'Datos actualizados');

// Suscribirse a notificaciones
this.notificationService.notifications$.subscribe(notifications => {
  console.log('Notificaciones activas:', notifications);
});
```

### Date Utils Service

```typescript
import { DateUtilsService } from '@chesspark/common-utils';

constructor(private dateUtils: DateUtilsService) {}

// Formatear fechas
const formatted = this.dateUtils.formatDate(new Date(), { format: 'long' });

// Tiempo relativo
const relative = this.dateUtils.getRelativeTime(new Date('2024-01-01'));

// Verificaciones de fecha
const isToday = this.dateUtils.isToday(someDate);
const isThisWeek = this.dateUtils.isThisWeek(someDate);
```

### Array Utils Service

```typescript
import { ArrayUtilsService } from '@chesspark/common-utils';

constructor(private arrayUtils: ArrayUtilsService) {}

// Ordenar arrays
const sorted = this.arrayUtils.sort(users, { key: 'name', direction: 'asc' });

// Agrupar arrays
const grouped = this.arrayUtils.groupBy(users, { key: 'department' });

// Filtrar arrays
const filtered = this.arrayUtils.filterBy(users, [
  { key: 'age', value: 25, operator: 'greaterThan' },
  { key: 'active', value: true, operator: 'equals' }
]);
```

### Storage Service

```typescript
import { StorageService } from '@chesspark/common-utils';

constructor(private storage: StorageService) {}

// Guardar datos
this.storage.set('user', userData, { encrypt: true, ttl: 3600000 });

// Obtener datos
const user = this.storage.get('user', { encrypt: true });

// Verificar existencia
const exists = this.storage.has('user');

// Limpiar almacenamiento
this.storage.clear('local', 'user_');
```

### Random FEN Service

```typescript
import { RandomFENService } from '@chesspark/common-utils';

constructor(private randomFEN: RandomFENService) {}

// Generar posición FEN aleatoria
const fen = this.randomFEN.generateRandomFEN();

// Generar posición realista
const realisticFEN = this.randomFEN.generateRealisticFEN();

// Generar final de partida
const endgame = this.randomFEN.generateEndgameFEN();

// Validar posición
const isValid = this.randomFEN.isValidFEN(fen);

// Analizar posición
const stats = this.randomFEN.analyzeFEN(fen);
```

### Elo Calculator Service

```typescript
import { EloCalculatorService } from '@chesspark/common-utils';

constructor(private eloCalculator: EloCalculatorService) {}

// Calcular nuevo ELO
const result = this.eloCalculator.calculateElo(1500, 1600, 1, { kFactor: 32 });
console.log(`Nuevo ELO: ${result.newElo}, Cambio: ${result.change}`);

// Calcular expectativa de resultado
const expected = this.eloCalculator.calculateExpectedOutcome(1500, 1600);

// Determinar categoría
const category = this.eloCalculator.getEloCategory(1800); // "Clase B"

// Promedio de ELOs
const avgElo = this.eloCalculator.calculateAverageElo([1500, 1600, 1700]);
```

### Uid Generator Service

```typescript
import { UidGeneratorService } from '@chesspark/common-utils';

constructor(private uidGenerator: UidGeneratorService) {}

// Generar UID simple (compatible con versión anterior)
const simpleUid = this.uidGenerator.generateSimpleUid();

// Generar UID con opciones
const uid = this.uidGenerator.generateUid({ 
  prefix: 'user',
  includeTimestamp: true 
});

// Generar UID corto
const shortUid = this.uidGenerator.generateShortUid(8);

// Generar UID largo
const longUid = this.uidGenerator.generateLongUid();

// Generar múltiples UIDs únicos
const uids = this.uidGenerator.generateMultipleUids(10);
```

### Random Number Service

```typescript
import { RandomNumberService } from '@chesspark/common-utils';

constructor(private randomNumber: RandomNumberService) {}

// Generar número simple (compatible con versión anterior)
const number = this.randomNumber.generateRandomNumber();

// Generar número en rango
const random = this.randomNumber.generateInRange(1, 100);

// Generar decimal
const decimal = this.randomNumber.generateDecimal(0, 1, 2);

// Generar múltiples números únicos
const uniqueNums = this.randomNumber.generateUnique(10, 1, 100);

// Generar color aleatorio
const color = this.randomNumber.generateColor(); // "#a3f5c2"

// Seleccionar elemento aleatorio
const randomItem = this.randomNumber.pickRandom([1, 2, 3, 4, 5]);

// Mezclar array
const shuffled = this.randomNumber.shuffle([1, 2, 3, 4, 5]);
```

### Validation Service

```typescript
import { ValidationService } from '@chesspark/common-utils';

constructor(private validation: ValidationService) {}

// Validar email
const isValidEmail = this.validation.isValidEmail('user@example.com');

// Validar contraseña
const isValidPassword = this.validation.isValidPassword(password, {
  minLength: 8,
  requireUppercase: true,
  requireNumbers: true
});

// Validar con reglas personalizadas
const result = this.validation.validate(value, [
  { type: 'required', message: 'Campo obligatorio' },
  { type: 'minLength', value: 3, message: 'Mínimo 3 caracteres' }
]);
```

### Number Utils Service

```typescript
import { NumberUtilsService } from '@chesspark/common-utils';

constructor(private numberUtils: NumberUtilsService) {}

// Formatear números
const formatted = this.numberUtils.formatNumber(1234.56, {
  thousandsSeparator: '.',
  decimalSeparator: ',',
  decimals: 2
});

// Calcular porcentajes
const percentage = this.numberUtils.calculatePercentage(25, 100);

// Estadísticas
const avg = this.numberUtils.average([1, 2, 3, 4, 5]);
const median = this.numberUtils.median([1, 2, 3, 4, 5]);
```

### String Utils Service

```typescript
import { StringUtilsService } from '@chesspark/common-utils';

constructor(private stringUtils: StringUtilsService) {}

// Cambiar caso
const titleCase = this.stringUtils.changeCase('hello world', 'title');
const camelCase = this.stringUtils.changeCase('hello world', 'camel');

// Formatear strings
const formatted = this.stringUtils.format('  hello  world  ', {
  trim: true,
  removeExtraSpaces: true,
  case: 'title'
});

// Utilidades de texto
const wordCount = this.stringUtils.wordCount('Hello world');
const isPalindrome = this.stringUtils.isPalindrome('racecar');
```

### Object Utils Service

```typescript
import { ObjectUtilsService } from '@chesspark/common-utils';

constructor(private objectUtils: ObjectUtilsService) {}

// Clonar objetos
const cloned = this.objectUtils.deepClone(originalObject);

// Fusionar objetos
const merged = this.objectUtils.merge(target, source, { deep: true });

// Obtener valores por ruta
const value = this.objectUtils.get(obj, 'user.profile.name', 'default');

// Verificar igualdad
const isEqual = this.objectUtils.isEqual(obj1, obj2);

// Filtrar objetos
const filtered = this.objectUtils.filter(obj, (value, key) => value > 0);
```

## 🎨 Temas de Confetti Disponibles

- `gold`: Colores dorados para celebraciones
- `white`: Tonos blancos
- `black`: Tonos negros
- `rainbow`: Colores del arcoíris
- `celebration`: Colores festivos

## 🔒 Almacenamiento Seguro

El servicio de almacenamiento incluye:
- Encriptación opcional de datos
- TTL (Time To Live) para expiración automática
- Prefijo personalizable para evitar conflictos
- Limpieza automática de elementos expirados

## 📱 Notificaciones

El sistema de notificaciones soporta:
- Diferentes tipos: success, error, warning, info
- Duración configurable
- Auto-dismiss opcional
- Posicionamiento personalizable
- Observable reactivo para el estado

## 🧪 Testing

```bash
# Ejecutar tests unitarios
nx test common-utils

# Ejecutar tests con coverage
nx test common-utils --coverage
```

## 📚 Documentación de la API

Para más detalles sobre cada servicio, consulta los archivos individuales en `src/lib/`.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes alguna pregunta o problema, por favor abre un issue en el repositorio.
