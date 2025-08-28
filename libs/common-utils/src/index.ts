// Servicios principales
export * from './lib/confetti.service';
export * from './lib/notification.service';
export * from './lib/date-utils.service';
export * from './lib/storage.service';
export * from './lib/random-fen.service'; // Servicio para generar posiciones FEN realistas de ajedrez
export * from './lib/sounds/sounds.service';


// Re-exportar tipos y interfaces
export type {
  ConfettiOptions,
  ConfettiTheme,
  Notification,
  NotificationOptions,
  DateFormatOptions,
  RelativeTimeOptions,
  StorageType,
  StorageOptions,
  StorageItem,
  ChessPosition,        // Posición en el tablero de ajedrez
  RandomFENOptions,     // Opciones para generación de FEN
} from './lib';
