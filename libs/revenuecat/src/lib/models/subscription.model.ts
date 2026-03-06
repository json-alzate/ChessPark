/**
 * Modelo que representa información de suscripción
 */
export interface Subscription {
  /** ID del producto de suscripción */
  productId: string;
  /** Tipo de suscripción */
  subscriptionType: 'monthly' | 'annual' | 'weekly' | 'lifetime';
  /** Fecha de inicio */
  startDate: Date;
  /** Fecha de expiración */
  expirationDate?: Date;
  /** Si está activa */
  isActive: boolean;
  /** Si está en período de prueba */
  isTrial: boolean;
  /** Si renovará automáticamente */
  willRenew: boolean;
  /** Período de suscripción en días */
  periodDays: number;
}
