/**
 * Modelo que representa un entitlement (derecho de acceso) en RevenueCat
 */
export interface Entitlement {
  /** Identificador único del entitlement */
  identifier: string;
  /** Si el entitlement está activo */
  isActive: boolean;
  /** Si el entitlement está en período de prueba */
  willRenew: boolean;
  /** Período del entitlement */
  periodType: 'NORMAL' | 'TRIAL' | 'INTRO';
  /** Fecha de última compra */
  latestPurchaseDate: string;
  /** Fecha de expiración original */
  originalPurchaseDate: string;
  /** Fecha de expiración */
  expirationDate?: string;
  /** ID de la tienda (App Store, Google Play) */
  store: string;
  /** ID del producto asociado */
  productIdentifier: string;
  /** Si está en sandbox */
  isSandbox: boolean;
  /** Fecha de cancelación si fue cancelado */
  unsubscribeDetectedAt?: string;
  /** Fecha de facturación si hay problema */
  billingIssueDetectedAt?: string;
}

/**
 * Colección de entitlements
 */
export interface EntitlementInfos {
  [key: string]: Entitlement;
}
