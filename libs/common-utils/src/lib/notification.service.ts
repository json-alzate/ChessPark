import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  timestamp: Date;
}

export interface NotificationOptions {
  duration?: number;
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private defaultDuration = 5000; // 5 segundos por defecto

  /**
   * Observable de las notificaciones activas
   */
  get notifications$(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  /**
   * Muestra una notificación de éxito
   * @param title Título de la notificación
   * @param message Mensaje de la notificación
   * @param options Opciones adicionales
   */
  success(title: string, message: string, options?: NotificationOptions): string {
    return this.show({
      type: 'success',
      title,
      message,
      ...options
    });
  }

  /**
   * Muestra una notificación de error
   * @param title Título de la notificación
   * @param message Mensaje de la notificación
   * @param options Opciones adicionales
   */
  error(title: string, message: string, options?: NotificationOptions): string {
    return this.show({
      type: 'error',
      title,
      message,
      ...options
    });
  }

  /**
   * Muestra una notificación de advertencia
   * @param title Título de la notificación
   * @param message Mensaje de la notificación
   * @param options Opciones adicionales
   */
  warning(title: string, message: string, options?: NotificationOptions): string {
    return this.show({
      type: 'warning',
      title,
      message,
      ...options
    });
  }

  /**
   * Muestra una notificación informativa
   * @param title Título de la notificación
   * @param message Mensaje de la notificación
   * @param options Opciones adicionales
   */
  info(title: string, message: string, options?: NotificationOptions): string {
    return this.show({
      type: 'info',
      title,
      message,
      ...options
    });
  }

  /**
   * Muestra una notificación personalizada
   * @param notification Datos de la notificación
   * @returns ID de la notificación creada
   */
  show(notification: Omit<Notification, 'id' | 'timestamp'>): string {
    const id = this.generateId();
    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      duration: notification.duration ?? this.defaultDuration,
      dismissible: notification.dismissible ?? true
    };

    const currentNotifications = this.notifications.value;
    this.notifications.next([...currentNotifications, fullNotification]);

    // Auto-dismiss si tiene duración
    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, fullNotification.duration);
    }

    return id;
  }

  /**
   * Cierra una notificación específica
   * @param id ID de la notificación a cerrar
   */
  dismiss(id: string): void {
    const currentNotifications = this.notifications.value;
    const filteredNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications.next(filteredNotifications);
  }

  /**
   * Cierra todas las notificaciones
   */
  dismissAll(): void {
    this.notifications.next([]);
  }

  /**
   * Cierra todas las notificaciones de un tipo específico
   * @param type Tipo de notificación a cerrar
   */
  dismissByType(type: Notification['type']): void {
    const currentNotifications = this.notifications.value;
    const filteredNotifications = currentNotifications.filter(n => n.type !== type);
    this.notifications.next(filteredNotifications);
  }

  /**
   * Obtiene el número de notificaciones activas
   */
  getCount(): number {
    return this.notifications.value.length;
  }

  /**
   * Obtiene el número de notificaciones de un tipo específico
   * @param type Tipo de notificación
   */
  getCountByType(type: Notification['type']): number {
    return this.notifications.value.filter(n => n.type === type).length;
  }

  /**
   * Verifica si hay notificaciones activas
   */
  hasNotifications(): boolean {
    return this.getCount() > 0;
  }

  /**
   * Verifica si hay notificaciones de un tipo específico
   * @param type Tipo de notificación
   */
  hasNotificationsByType(type: Notification['type']): boolean {
    return this.getCountByType(type) > 0;
  }

  /**
   * Genera un ID único para la notificación
   * @returns ID único
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

