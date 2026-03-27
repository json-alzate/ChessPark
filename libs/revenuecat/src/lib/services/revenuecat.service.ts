import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { IRevenueCatService, LogLevel } from '../interfaces/revenuecat.interface';
import { CustomerInfo, Offerings, Offering, Package, PurchaseResult } from '../models';
import { PurchasesError, PURCHASES_ERROR_CODE, mapRevenueCatError } from '../utils/error-handler.util';

// Tipos para RevenueCat (se usarán solo cuando el módulo esté disponible)
type PurchasesType = any;
type PurchasesOfferingType = any;
type PurchasesPackageType = any;
type RCCustomerInfoType = any;
type RCPurchasesErrorType = any;
type LOG_LEVELType = any;

// Variable para almacenar el módulo cargado dinámicamente
let PurchasesModule: {
  Purchases: PurchasesType;
  PurchasesOffering: PurchasesOfferingType;
  PurchasesPackage: PurchasesPackageType;
  CustomerInfo: RCCustomerInfoType;
  PurchasesError: RCPurchasesErrorType;
  LOG_LEVEL: LOG_LEVELType;
} | null = null;

// Función para cargar el módulo dinámicamente
async function loadRevenueCatModule() {
  if (PurchasesModule) {
    return PurchasesModule;
  }

  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // Usamos el import normal dinámico para que el empaquetador de Angular (Webpack/esbuild)
    // reconozca la dependencia y la incluya en el build final.
    PurchasesModule = (await import('@revenuecat/purchases-capacitor')) as any;
    return PurchasesModule;
  } catch (error) {
    console.error('Error loading RevenueCat module. Please run: npm install @revenuecat/purchases-capacitor', error);
    return null;
  }
}

/**
 * Servicio principal para integración con RevenueCat
 * Proporciona una abstracción unificada para gestionar suscripciones
 * y compras únicas (donaciones) en Android e iOS
 */
@Injectable({
  providedIn: 'root',
})
export class RevenueCatService implements IRevenueCatService {
  private httpClient = inject(HttpClient);
  private initialized = false;
  private customerInfoSubject = new Subject<CustomerInfo>();
  private currentAppUserID: string | null = null;
  private publicAPIKey: string | null = null;

  // Base URL para la API REST de RevenueCat
  private readonly REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

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
    // Almacenar API key y user ID para uso en web (REST API)
    this.publicAPIKey = apiKey;
    if (appUserID) {
      this.currentAppUserID = appUserID;
    }

    if (!this.isNativePlatform) {
      // En web, no inicializamos el SDK, pero guardamos las credenciales para REST API
      console.log('RevenueCat funcionará en modo web usando API REST');
      return;
    }

    const module = await loadRevenueCatModule();
    if (!module) {
      console.error('RevenueCat module not available. Please run: npm install @revenuecat/purchases-capacitor');
      return;
    }

    try {
      await module.Purchases.configure({
        apiKey,
        appUserID,
      });

      this.initialized = true;
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

  /**
   * Configura el usuario actual
   * @param userId ID único del usuario para sincronización multiplataforma
   */
  async configure(userId?: string): Promise<void> {
    // Almacenar user ID para uso en web (REST API)
    if (userId) {
      this.currentAppUserID = userId;
    }

    if (!this.isNativePlatform) {
      // En web, solo guardamos el user ID para usar en REST API
      return;
    }

    if (!this.initialized) {
      return;
    }

    const module = await loadRevenueCatModule();
    if (!module) {
      return;
    }

    try {
      if (userId) {
        await module.Purchases.logIn(userId);
      }
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

  /**
   * Obtiene las ofertas disponibles
   * @returns Promise con las ofertas disponibles
   */
  async getOfferings(): Promise<Offerings> {
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat module not available'
      );
    }

    try {
      const offerings = await module.Purchases.getOfferings();
      return this.mapOfferings(offerings, module);
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

  /**
   * Realiza una compra de un package
   * @param packageToPurchase Package a comprar
   * @returns Promise con el resultado de la compra
   */
  async purchasePackage(packageToPurchase: Package): Promise<PurchaseResult> {
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat module not available'
      );
    }

    try {
      // Convertir nuestro Package a PurchasesPackage
      const rcPackage = await this.getRCPackage(packageToPurchase, module);
      const purchaseResult = await module.Purchases.purchasePackage({ aPackage: rcPackage });

      const customerInfo = this.mapCustomerInfo(purchaseResult.customerInfo);
      // Emitir actualización del estado del cliente
      this.customerInfoSubject.next(customerInfo);

      return {
        customerInfo,
        userCancelled: purchaseResult.userCancelled || false,
      };
    } catch (error: unknown) {
      const rcError = error as any;
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

    const module = await loadRevenueCatModule();
    if (!module) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat module not available'
      );
    }

    try {
      const customerInfo = await module.Purchases.restorePurchases();
      const mapped = this.mapCustomerInfo(customerInfo);
      this.customerInfoSubject.next(mapped);
      return mapped;
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

  /**
   * Obtiene la información completa del cliente
   * @returns Promise con la información del cliente
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    // En web, usar API REST
    if (!this.isNativePlatform) {
      return await this.getCustomerInfoWeb();
    }

    // En móvil, usar SDK
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat module not available'
      );
    }

    try {
      const customerInfo = await module.Purchases.getCustomerInfo();
      return this.mapCustomerInfo(customerInfo);
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
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
    // En web, usar API REST
    if (!this.isNativePlatform) {
      return await this.checkSubscriptionStatusWeb(entitlementId);
    }

    // En móvil, usar SDK
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      return false;
    }

    try {
      const customerInfo = await module.Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[entitlementId];
      return entitlement?.isActive === true;
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

  /**
   * Sincroniza las compras con el servidor de RevenueCat
   */
  async syncPurchases(): Promise<void> {
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      return;
    }

    try {
      // RevenueCat sincroniza automáticamente, pero podemos forzar una actualización
      await module.Purchases.getCustomerInfo();
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
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

    loadRevenueCatModule().then((module) => {
      if (module) {
        const rcLogLevel = this.mapLogLevel(level, module);
        module.Purchases.setLogLevel(rcLogLevel);
      }
    });
  }

  /**
   * Obtiene el appUserID actual
   */
  private async getCurrentAppUserID(): Promise<string> {
    if (!this.currentAppUserID) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'appUserID no configurado. Llama a initialize() o configure() primero.'
      );
    }
    return this.currentAppUserID;
  }

  /**
   * Obtiene la Public API Key
   */
  private getPublicAPIKey(): string {
    if (!this.publicAPIKey) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'API Key no configurada. Llama a initialize() primero.'
      );
    }
    return this.publicAPIKey;
  }

  /**
   * Obtiene información del cliente usando API REST (para web)
   */
  private async getCustomerInfoWeb(): Promise<CustomerInfo> {
    try {
      const appUserID = await this.getCurrentAppUserID();
      const apiKey = this.getPublicAPIKey();
      const url = `${this.REVENUECAT_API_BASE}/subscribers/${appUserID}`;

      const response = await firstValueFrom(
        this.httpClient.get<any>(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      return this.mapCustomerInfoFromAPI(response.subscriber);
    } catch (error: unknown) {
      if (error instanceof PurchasesError) {
        throw error;
      }
      // Manejar errores HTTP
      const httpError = error as any;
      if (httpError.status === 404) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
          'Usuario no encontrado en RevenueCat'
        );
      }
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.NETWORK_ERROR,
        `Error al obtener información del cliente: ${httpError.message || 'Error desconocido'}`
      );
    }
  }

  /**
   * Verifica estado de suscripción usando API REST (para web)
   */
  private async checkSubscriptionStatusWeb(entitlementId: string): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfoWeb();
      const entitlement = customerInfo.entitlements.active[entitlementId];
      return entitlement?.isActive === true;
    } catch (error: unknown) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Mapea la respuesta de la API REST a nuestro modelo CustomerInfo
   */
  private mapCustomerInfoFromAPI(apiSubscriber: any): CustomerInfo {
    // La API REST de RevenueCat retorna datos en formato diferente
    const entitlements = apiSubscriber.entitlements || {};
    const activeEntitlements: any = {};
    const allEntitlements: any = {};

    // Mapear entitlements
    Object.keys(entitlements).forEach((key) => {
      const entitlement = entitlements[key];
      const mappedEntitlement = {
        identifier: entitlement.identifier || key,
        isActive: entitlement.expires_date === null || new Date(entitlement.expires_date) > new Date(),
        willRenew: entitlement.will_renew || false,
        periodType: entitlement.period_type || 'NORMAL',
        latestPurchaseDate: entitlement.latest_purchase_date || '',
        originalPurchaseDate: entitlement.original_purchase_date || '',
        expirationDate: entitlement.expires_date || null,
        store: entitlement.store || '',
        productIdentifier: entitlement.product_identifier || '',
        isSandbox: entitlement.is_sandbox || false,
        unsubscribeDetectedAt: entitlement.unsubscribe_detected_at || null,
        billingIssueDetectedAt: entitlement.billing_issue_detected_at || null,
      };

      allEntitlements[key] = mappedEntitlement;
      if (mappedEntitlement.isActive) {
        activeEntitlements[key] = mappedEntitlement;
      }
    });

    return {
      originalAppUserId: apiSubscriber.original_app_user_id || '',
      firstSeen: apiSubscriber.first_seen || '',
      originalPurchaseDate: apiSubscriber.original_purchase_date || '',
      requestDate: apiSubscriber.request_date || new Date().toISOString(),
      entitlements: {
        active: activeEntitlements,
        all: allEntitlements,
      },
      nonSubscriptions: apiSubscriber.non_subscriptions || {},
      allPurchaseDates: apiSubscriber.all_purchase_dates || {},
      allExpirationDates: apiSubscriber.all_expiration_dates || {},
      allPurchasedProductIdentifiers: apiSubscriber.all_purchased_product_identifiers || [],
      activeSubscriptions: apiSubscriber.active_subscriptions || [],
      allExpirationDatesByProduct: apiSubscriber.all_expiration_dates_by_product || {},
    };
  }

  /**
   * Verifica que el servicio esté inicializado (solo para móvil)
   */
  private ensureInitialized(): void {
    if (!this.isNativePlatform) {
      // En web no necesitamos inicialización del SDK
      return;
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
  private mapCustomerInfo(rcCustomerInfo: RCCustomerInfoType): CustomerInfo {
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
  private mapOfferings(rcOfferings: { current?: PurchasesOfferingType; all: { [key: string]: PurchasesOfferingType } }, module: any): Offerings {
    const mapped: Offerings = {
      all: {},
    };

    // Mapear todos los offerings
    Object.keys(rcOfferings.all || {}).forEach((key) => {
      mapped.all[key] = this.mapOffering(rcOfferings.all[key], module);
    });

    // Mapear offering actual
    if (rcOfferings.current) {
      mapped.current = this.mapOffering(rcOfferings.current, module);
    }

    return mapped;
  }

  /**
   * Mapea un Offering de RevenueCat a nuestro modelo
   */
  private mapOffering(rcOffering: PurchasesOfferingType, module: any): Offering {
    const packages = (rcOffering.availablePackages || []).map((pkg: PurchasesPackageType) => this.mapPackage(pkg));

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
  private mapPackage(rcPackage: PurchasesPackageType): Package {
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
  private async getRCPackage(packageToPurchase: Package, module: any): Promise<PurchasesPackageType> {
    const offerings = await module.Purchases.getOfferings();
    if (!offerings.current) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE,
        'No hay ofertas disponibles'
      );
    }

    const rcPackage = offerings.current.availablePackages.find(
      (pkg: PurchasesPackageType) => pkg.identifier === packageToPurchase.identifier
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
  private mapLogLevel(level: LogLevel, module: any): LOG_LEVELType {
    const mapping: { [key in LogLevel]: LOG_LEVELType } = {
      [LogLevel.VERBOSE]: module.LOG_LEVEL.VERBOSE,
      [LogLevel.DEBUG]: module.LOG_LEVEL.DEBUG,
      [LogLevel.INFO]: module.LOG_LEVEL.INFO,
      [LogLevel.WARN]: module.LOG_LEVEL.WARN,
      [LogLevel.ERROR]: module.LOG_LEVEL.ERROR,
    };

    return mapping[level] || module.LOG_LEVEL.INFO;
  }
}
