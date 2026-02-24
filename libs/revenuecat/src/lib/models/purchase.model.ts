import { CustomerInfo } from './customer-info.model';

/**
 * Resultado de una compra exitosa
 */
export interface PurchaseResult {
  /** Información actualizada del cliente */
  customerInfo: CustomerInfo;
  /** Si la compra fue realizada exitosamente */
  userCancelled?: boolean;
}

/**
 * Estado de una suscripción
 */
export interface SubscriptionStatus {
  /** Si la suscripción está activa */
  isActive: boolean;
  /** ID del producto de suscripción */
  productId: string;
  /** Fecha de expiración */
  expirationDate?: Date;
  /** Fecha de compra original */
  originalPurchaseDate: Date;
  /** Si está en período de prueba */
  isTrialPeriod: boolean;
  /** Si está en período promocional */
  isIntroPricePeriod: boolean;
  /** Si renovará automáticamente */
  willRenew: boolean;
}
