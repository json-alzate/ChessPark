import { EntitlementInfos } from './entitlement.model';

/**
 * Modelo que representa la información completa del cliente en RevenueCat
 */
export interface CustomerInfo {
  /** ID único del usuario en RevenueCat */
  originalAppUserId: string;
  /** Fecha de primera compra */
  firstSeen: string;
  /** Fecha de última compra */
  originalPurchaseDate: string;
  /** Fecha de última actualización */
  requestDate: string;
  /** Entitlements activos */
  entitlements: {
    active: EntitlementInfos;
    all: EntitlementInfos;
  };
  /** Productos no consumidos */
  nonSubscriptions: { [key: string]: Transaction[] };
  /** Todas las transacciones */
  allPurchaseDates: { [key: string]: string };
  /** Fechas de compra originales */
  allExpirationDates: { [key: string]: string | null };
  /** Fechas de compra no consumidas */
  allPurchasedProductIdentifiers: string[];
  /** IDs de productos con suscripciones activas */
  activeSubscriptions: string[];
  /** IDs de productos con suscripciones no activas */
  allExpirationDatesByProduct: { [key: string]: string | null };
}

/**
 * Modelo de transacción
 */
export interface Transaction {
  /** ID de la transacción */
  transactionIdentifier: string;
  /** ID del producto */
  productIdentifier: string;
  /** Fecha de compra */
  purchaseDate: string;
  /** ID de la tienda */
  store: string;
}
