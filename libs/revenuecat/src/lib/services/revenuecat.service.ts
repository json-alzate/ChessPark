import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Purchases, PurchasesOffering, PurchasesPackage, CustomerInfo as RCCustomerInfo, PurchasesError as RCPurchasesError, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { IRevenueCatService, LogLevel } from '../interfaces/revenuecat.interface';
import { CustomerInfo, Offerings, Offering, Package, PurchaseResult } from '../models';
import { PurchasesError, PURCHASES_ERROR_CODE, mapRevenueCatError } from '../utils/error-handler.util';

/**
 * Servicio principal para integración con RevenueCat
 * Proporciona una abstracción unificada para gestionar suscripciones
 * y compras únicas (donaciones) en Android e iOS
 */
@Injectable({
  providedIn: 'root',
})
export class RevenueCatService implements IRevenueCatService {
  private initialized = false;
  private customerInfoSubject = new Subject<CustomerInfo>();

  /**
   * Observable que emite cuando cambia la información del cliente
   */
  public readonly customerInfoUpdates$: Observable<CustomerInfo> = this.customerInfoSubject.asObservable();

  /**
   * Verifica si la plataforma es nativa (Android o iOS)
   */
  private get isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Inicializa el SDK de RevenueCat
   * @param apiKey API Key pública de RevenueCat
   * @param appUserID ID único del usuario (opcional)
   */
  async initialize(apiKey: string, appUserID?: string): Promise<void> {
    if (!this.isNativePlatform) {
      console.warn('RevenueCat solo está disponible en plataformas nativas (Android/iOS)');
      return;
    }

    try {
      await Purchases.configure({
        apiKey,
        appUserID,
      });

      // Configurar listener para cambios en customer info
      // Nota: El listener se configura automáticamente, pero podemos suscribirnos manualmente
      // cuando se actualice la información del cliente

      this.initialized = true;
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Configura el usuario actual
   * @param userId ID único del usuario para sincronización multiplataforma
   */
  async configure(userId?: string): Promise<void> {
    if (!this.isNativePlatform || !this.initialized) {
      return;
    }

    try {
      if (userId) {
        await Purchases.logIn(userId);
      }
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Obtiene las ofertas disponibles
   * @returns Promise con las ofertas disponibles
   */
  async getOfferings(): Promise<Offerings> {
    this.ensureInitialized();

    try {
      const offerings = await Purchases.getOfferings();
      return this.mapOfferings(offerings);
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Realiza una compra de un package
   * @param packageToPurchase Package a comprar
   * @returns Promise con el resultado de la compra
   */
  async purchasePackage(packageToPurchase: Package): Promise<PurchaseResult> {
    this.ensureInitialized();

    try {
      // Convertir nuestro Package a PurchasesPackage
      const rcPackage = await this.getRCPackage(packageToPurchase);
      const purchaseResult = await Purchases.purchasePackage({ aPackage: rcPackage });

      const customerInfo = this.mapCustomerInfo(purchaseResult.customerInfo);
      // Emitir actualización del estado del cliente
      this.customerInfoSubject.next(customerInfo);

      return {
        customerInfo,
        userCancelled: purchaseResult.userCancelled || false,
      };
    } catch (error) {
      const rcError = error as RCPurchasesError;
      if (rcError.userCancelled) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.PURCHASE_CANCELLED,
          'El usuario canceló la compra'
        );
      }
      throw mapRevenueCatError(rcError);
    }
  }

  /**
   * Restaura las compras previas del usuario
   * @returns Promise con la información actualizada del cliente
   */
  async restorePurchases(): Promise<CustomerInfo> {
    this.ensureInitialized();

    try {
      const customerInfo = await Purchases.restorePurchases();
      const mapped = this.mapCustomerInfo(customerInfo);
      this.customerInfoSubject.next(mapped);
      return mapped;
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Obtiene la información completa del cliente
   * @returns Promise con la información del cliente
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    this.ensureInitialized();

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.mapCustomerInfo(customerInfo);
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Verifica si el usuario tiene un entitlement activo
   * @param entitlementId ID del entitlement a verificar
   * @returns Promise con true si está activo, false en caso contrario
   */
  async isSubscribed(entitlementId: string): Promise<boolean> {
    return this.checkSubscriptionStatus(entitlementId);
  }

  /**
   * Verifica el estado de un entitlement específico
   * @param entitlementId ID del entitlement
   * @returns Promise con true si está activo
   */
  async checkSubscriptionStatus(entitlementId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[entitlementId];
      return entitlement?.isActive === true;
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Sincroniza las compras con el servidor de RevenueCat
   */
  async syncPurchases(): Promise<void> {
    this.ensureInitialized();

    try {
      // RevenueCat sincroniza automáticamente, pero podemos forzar una actualización
      await Purchases.getCustomerInfo();
    } catch (error) {
      throw mapRevenueCatError(error as RCPurchasesError);
    }
  }

  /**
   * Configura el nivel de logging
   * @param level Nivel de logging deseado
   */
  setLogLevel(level: LogLevel): void {
    if (!this.isNativePlatform) {
      return;
    }

    const rcLogLevel = this.mapLogLevel(level);
    Purchases.setLogLevel(rcLogLevel);
  }

  /**
   * Verifica que el servicio esté inicializado
   */
  private ensureInitialized(): void {
    if (!this.isNativePlatform) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat solo está disponible en plataformas nativas (Android/iOS)'
      );
    }

    if (!this.initialized) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat no ha sido inicializado. Llama a initialize() primero.'
      );
    }
  }

  /**
   * Mapea CustomerInfo de RevenueCat a nuestro modelo
   */
  private mapCustomerInfo(rcCustomerInfo: RCCustomerInfo): CustomerInfo {
    return {
      originalAppUserId: rcCustomerInfo.originalAppUserId,
      firstSeen: rcCustomerInfo.firstSeen,
      originalPurchaseDate: rcCustomerInfo.originalPurchaseDate,
      requestDate: rcCustomerInfo.requestDate,
      entitlements: {
        active: rcCustomerInfo.entitlements.active || {},
        all: rcCustomerInfo.entitlements.all || {},
      },
      nonSubscriptions: rcCustomerInfo.nonSubscriptions || {},
      allPurchaseDates: rcCustomerInfo.allPurchaseDates || {},
      allExpirationDates: rcCustomerInfo.allExpirationDates || {},
      allPurchasedProductIdentifiers: rcCustomerInfo.allPurchasedProductIdentifiers || [],
      activeSubscriptions: rcCustomerInfo.activeSubscriptions || [],
      allExpirationDatesByProduct: rcCustomerInfo.allExpirationDatesByProduct || {},
    };
  }

  /**
   * Mapea Offerings de RevenueCat a nuestro modelo
   */
  private mapOfferings(rcOfferings: { current?: PurchasesOffering; all: { [key: string]: PurchasesOffering } }): Offerings {
    const mapped: Offerings = {
      all: {},
    };

    // Mapear todos los offerings
    Object.keys(rcOfferings.all || {}).forEach((key) => {
      mapped.all[key] = this.mapOffering(rcOfferings.all[key]);
    });

    // Mapear offering actual
    if (rcOfferings.current) {
      mapped.current = this.mapOffering(rcOfferings.current);
    }

    return mapped;
  }

  /**
   * Mapea un Offering de RevenueCat a nuestro modelo
   */
  private mapOffering(rcOffering: PurchasesOffering): Offering {
    const packages = (rcOffering.availablePackages || []).map((pkg) => this.mapPackage(pkg));

    const offering: Offering = {
      identifier: rcOffering.identifier,
      serverDescription: rcOffering.serverDescription || '',
      metadata: rcOffering.metadata || {},
      availablePackages: packages,
    };

    // Mapear packages específicos si existen
    if (rcOffering.lifetime) offering.lifetime = this.mapPackage(rcOffering.lifetime);
    if (rcOffering.annual) offering.annual = this.mapPackage(rcOffering.annual);
    if (rcOffering.sixMonth) offering.sixMonth = this.mapPackage(rcOffering.sixMonth);
    if (rcOffering.threeMonth) offering.threeMonth = this.mapPackage(rcOffering.threeMonth);
    if (rcOffering.twoMonth) offering.twoMonth = this.mapPackage(rcOffering.twoMonth);
    if (rcOffering.monthly) offering.monthly = this.mapPackage(rcOffering.monthly);
    if (rcOffering.weekly) offering.weekly = this.mapPackage(rcOffering.weekly);

    return offering;
  }

  /**
   * Mapea un Package de RevenueCat a nuestro modelo
   */
  private mapPackage(rcPackage: PurchasesPackage): Package {
    return {
      identifier: rcPackage.identifier,
      packageType: rcPackage.packageType,
      product: {
        identifier: rcPackage.product.identifier,
        description: rcPackage.product.description,
        title: rcPackage.product.title,
        priceString: rcPackage.product.priceString,
        price: rcPackage.product.price,
        currencyCode: rcPackage.product.currencyCode,
        productType: rcPackage.product.productType as 'subscription' | 'consumable' | 'non_consumable',
        subscriptionPeriod: rcPackage.product.subscriptionPeriod,
        introPrice: rcPackage.product.introPrice ? {
          priceString: rcPackage.product.introPrice.priceString,
          price: rcPackage.product.introPrice.price,
          period: rcPackage.product.introPrice.period,
          cycles: rcPackage.product.introPrice.cycles,
        } : undefined,
      },
      offeringIdentifier: rcPackage.offeringIdentifier,
    };
  }

  /**
   * Obtiene el PurchasesPackage correspondiente a nuestro Package
   */
  private async getRCPackage(packageToPurchase: Package): Promise<PurchasesPackage> {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE,
        'No hay ofertas disponibles'
      );
    }

    const rcPackage = offerings.current.availablePackages.find(
      (pkg) => pkg.identifier === packageToPurchase.identifier
    );

    if (!rcPackage) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE,
        `Package ${packageToPurchase.identifier} no encontrado`
      );
    }

    return rcPackage;
  }

  /**
   * Mapea nuestro LogLevel al de RevenueCat
   */
  private mapLogLevel(level: LogLevel): LOG_LEVEL {
    const mapping: { [key in LogLevel]: LOG_LEVEL } = {
      [LogLevel.VERBOSE]: LOG_LEVEL.VERBOSE,
      [LogLevel.DEBUG]: LOG_LEVEL.DEBUG,
      [LogLevel.INFO]: LOG_LEVEL.INFO,
      [LogLevel.WARN]: LOG_LEVEL.WARN,
      [LogLevel.ERROR]: LOG_LEVEL.ERROR,
    };

    return mapping[level] || LOG_LEVEL.INFO;
  }
}
