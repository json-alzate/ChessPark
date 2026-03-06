import { Observable } from 'rxjs';
import { CustomerInfo } from '../models/customer-info.model';
import { Offerings } from '../models/offering.model';
import { Package } from '../models/offering.model';
import { PurchaseResult } from '../models/purchase.model';

/**
 * Nivel de logging para RevenueCat
 */
export enum LogLevel {
  VERBOSE = 'VERBOSE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Interfaz principal del servicio RevenueCat
 */
export interface IRevenueCatService {
  /**
   * Inicializa el SDK de RevenueCat
   * @param apiKey API Key pública de RevenueCat
   * @param appUserID ID único del usuario (opcional)
   */
  initialize(apiKey: string, appUserID?: string): Promise<void>;

  /**
   * Configura el usuario actual
   * @param userId ID único del usuario para sincronización multiplataforma
   */
  configure(userId?: string): Promise<void>;

  /**
   * Obtiene las ofertas disponibles
   * @returns Promise con las ofertas disponibles
   */
  getOfferings(): Promise<Offerings>;

  /**
   * Realiza una compra de un package
   * @param packageToPurchase Package a comprar
   * @returns Promise con el resultado de la compra
   */
  purchasePackage(packageToPurchase: Package): Promise<PurchaseResult>;

  /**
   * Restaura las compras previas del usuario
   * @returns Promise con la información actualizada del cliente
   */
  restorePurchases(): Promise<CustomerInfo>;

  /**
   * Obtiene la información completa del cliente
   * @returns Promise con la información del cliente
   */
  getCustomerInfo(): Promise<CustomerInfo>;

  /**
   * Verifica si el usuario tiene un entitlement activo
   * @param entitlementId ID del entitlement a verificar
   * @returns Promise con true si está activo, false en caso contrario
   */
  isSubscribed(entitlementId: string): Promise<boolean>;

  /**
   * Verifica el estado de un entitlement específico
   * @param entitlementId ID del entitlement
   * @returns Promise con true si está activo
   */
  checkSubscriptionStatus(entitlementId: string): Promise<boolean>;

  /**
   * Sincroniza las compras con el servidor de RevenueCat
   */
  syncPurchases(): Promise<void>;

  /**
   * Configura el nivel de logging
   * @param level Nivel de logging deseado
   */
  setLogLevel(level: LogLevel): void;

  /**
   * Observable que emite cuando cambia la información del cliente
   */
  customerInfoUpdates$: Observable<CustomerInfo>;
}
