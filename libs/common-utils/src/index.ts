// Servicios principales
export * from './lib/confetti.service';
export * from './lib/notification.service';
export * from './lib/date-utils.service';
export * from './lib/storage.service';



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
} from './lib';
