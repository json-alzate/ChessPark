import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { IRevenueCatService, LogLevel } from '../interfaces/revenuecat.interface';
import { CustomerInfo, Offerings, Offering, Package, PurchaseResult } from '../models';
import { PurchasesError, PURCHASES_ERROR_CODE, mapRevenueCatError } from '../utils/error-handler.util';

type PurchasesType = any;
type PurchasesOfferingType = any;
type PurchasesPackageType = any;
type RCCustomerInfoType = any;
type RCPurchasesErrorType = any;
type LOG_LEVELType = any;

let PurchasesModule: {
  Purchases: PurchasesType;
  PurchasesOffering: PurchasesOfferingType;
  PurchasesPackage: PurchasesPackageType;
  CustomerInfo: RCCustomerInfoType;
  PurchasesError: RCPurchasesErrorType;
  LOG_LEVEL: LOG_LEVELType;
} | null = null;

let WebPurchasesModule: { Purchases: any } | null = null;

async function loadRevenueCatModule() {
  if (PurchasesModule) {
    return PurchasesModule;
  }

  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    PurchasesModule = (await import('@revenuecat/purchases-capacitor')) as any;
    return PurchasesModule;
  } catch (error) {
    console.error('Error loading RevenueCat module. Please run: npm install @revenuecat/purchases-capacitor', error);
    return null;
  }
}

async function loadRevenueCatWebModule() {
  if (WebPurchasesModule) {
    return WebPurchasesModule;
  }

  if (Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    WebPurchasesModule = (await import('@revenuecat/purchases-js')) as any;
    return WebPurchasesModule;
  } catch (error) {
    console.error('Error loading RevenueCat Web module. Please run: npm install @revenuecat/purchases-js', error);
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class RevenueCatService implements IRevenueCatService {
  private httpClient = inject(HttpClient);
  private initialized = false;
  private customerInfoSubject = new Subject<CustomerInfo>();
  private currentAppUserID: string | null = null;
  private publicAPIKey: string | null = null;

  // Web SDK instance
  private webPurchasesInstance: any | null = null;
  // Maps package identifier → raw web SDK Package, needed to call purchasePackage()
  private webPackagesCache = new Map<string, any>();

  private readonly REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

  public readonly customerInfoUpdates$: Observable<CustomerInfo> = this.customerInfoSubject.asObservable();

  private get isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  async initialize(apiKey: string, appUserID?: string): Promise<void> {
    this.publicAPIKey = apiKey;
    if (appUserID) {
      this.currentAppUserID = appUserID;
    }

    if (!this.isNativePlatform) {
      // On web, initialize the SDK only if we already have a userId.
      // If not, configure() will initialize it once the user authenticates.
      if (appUserID) {
        await this.initializeWebSDK(apiKey, appUserID);
      }
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

  async configure(userId?: string): Promise<void> {
    if (userId) {
      this.currentAppUserID = userId;
    }

    if (!this.isNativePlatform) {
      if (!userId || !this.publicAPIKey) {
        return;
      }

      if (!this.webPurchasesInstance) {
        await this.initializeWebSDK(this.publicAPIKey, userId);
      } else {
        try {
          await this.webPurchasesInstance.changeUser(userId);
          const info = await this.webPurchasesInstance.getCustomerInfo();
          this.customerInfoSubject.next(this.mapCustomerInfoFromWebSDK(info));
        } catch (error: unknown) {
          console.error('Error changing web SDK user:', error);
        }
      }
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

  async getOfferings(): Promise<Offerings> {
    if (!this.isNativePlatform) {
      if (!this.webPurchasesInstance) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
          'RevenueCat Web no inicializado. El usuario debe estar autenticado.'
        );
      }

      try {
        const offerings = await this.webPurchasesInstance.getOfferings();
        return this.mapOfferingsFromWeb(offerings);
      } catch (error: unknown) {
        if (error instanceof PurchasesError) throw error;
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.NETWORK_ERROR,
          `Error al obtener ofertas: ${(error as any)?.message || 'Error desconocido'}`
        );
      }
    }

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

  async purchasePackage(packageToPurchase: Package): Promise<PurchaseResult> {
    if (!this.isNativePlatform) {
      if (!this.webPurchasesInstance) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
          'RevenueCat Web no inicializado. El usuario debe estar autenticado.'
        );
      }

      const webPkg = this.webPackagesCache.get(packageToPurchase.identifier);
      if (!webPkg) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE,
          `Package "${packageToPurchase.identifier}" no disponible en web. Carga las ofertas primero.`
        );
      }

      try {
        const result = await this.webPurchasesInstance.purchasePackage(webPkg);
        const customerInfo = this.mapCustomerInfoFromWebSDK(result.customerInfo);
        this.customerInfoSubject.next(customerInfo);
        return { customerInfo, userCancelled: false };
      } catch (error: unknown) {
        const err = error as any;
        const message: string = err?.message || err?.errorCode || '';
        if (
          message.toLowerCase().includes('cancel') ||
          err?.errorCode === 'USER_CANCELLED' ||
          err?.code === 'USER_CANCELLED'
        ) {
          throw new PurchasesError(
            PURCHASES_ERROR_CODE.PURCHASE_CANCELLED,
            'El usuario canceló la compra'
          );
        }
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.UNKNOWN_ERROR,
          `Error en compra web: ${message || 'Error desconocido'}`
        );
      }
    }

    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat module not available'
      );
    }

    try {
      const rcPackage = await this.getRCPackage(packageToPurchase, module);
      const purchaseResult = await module.Purchases.purchasePackage({ aPackage: rcPackage });

      const customerInfo = this.mapCustomerInfo(purchaseResult.customerInfo);
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

  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isNativePlatform) {
      if (!this.webPurchasesInstance) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
          'RevenueCat Web no inicializado. El usuario debe estar autenticado.'
        );
      }

      try {
        await this.webPurchasesInstance.syncPurchases();
        const info = await this.webPurchasesInstance.getCustomerInfo();
        const mapped = this.mapCustomerInfoFromWebSDK(info);
        this.customerInfoSubject.next(mapped);
        return mapped;
      } catch (error: unknown) {
        throw new PurchasesError(
          PURCHASES_ERROR_CODE.NETWORK_ERROR,
          `Error al restaurar compras: ${(error as any)?.message || 'Error desconocido'}`
        );
      }
    }

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

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isNativePlatform) {
      if (this.webPurchasesInstance) {
        try {
          const info = await this.webPurchasesInstance.getCustomerInfo();
          return this.mapCustomerInfoFromWebSDK(info);
        } catch (error: unknown) {
          throw new PurchasesError(
            PURCHASES_ERROR_CODE.NETWORK_ERROR,
            `Error al obtener info del cliente: ${(error as any)?.message || 'Error desconocido'}`
          );
        }
      }
      // Fallback to REST API when web SDK is not yet initialized
      return await this.getCustomerInfoWeb();
    }

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

  async isSubscribed(entitlementId: string): Promise<boolean> {
    return this.checkSubscriptionStatus(entitlementId);
  }

  async checkSubscriptionStatus(entitlementId: string): Promise<boolean> {
    if (!this.isNativePlatform) {
      try {
        const customerInfo = await this.getCustomerInfo();
        return customerInfo.entitlements.active[entitlementId]?.isActive === true;
      } catch (error: unknown) {
        console.error('Error checking subscription status:', error);
        return false;
      }
    }

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

  async syncPurchases(): Promise<void> {
    this.ensureInitialized();

    const module = await loadRevenueCatModule();
    if (!module) {
      return;
    }

    try {
      await module.Purchases.getCustomerInfo();
    } catch (error: unknown) {
      throw mapRevenueCatError(error as any);
    }
  }

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

  // ─── Web SDK helpers ────────────────────────────────────────────────────────

  private async initializeWebSDK(apiKey: string, userId: string): Promise<void> {
    try {
      const webModule = await loadRevenueCatWebModule();
      if (!webModule) {
        return;
      }

      this.webPurchasesInstance = webModule.Purchases.configure(apiKey, userId);
      this.initialized = true;
      console.log('RevenueCat Web SDK inicializado correctamente');
    } catch (error: unknown) {
      console.error('Error inicializando RevenueCat Web SDK:', error);
    }
  }

  private mapOfferingsFromWeb(webOfferings: any): Offerings {
    const mapped: Offerings = { all: {} };

    const allOfferings = webOfferings.all || {};
    Object.keys(allOfferings).forEach((key) => {
      mapped.all[key] = this.mapOfferingFromWeb(allOfferings[key]);
    });

    if (webOfferings.current) {
      mapped.current = this.mapOfferingFromWeb(webOfferings.current);
    }

    return mapped;
  }

  private mapOfferingFromWeb(webOffering: any): Offering {
    const packages = (webOffering.availablePackages || []).map((pkg: any) => {
      this.webPackagesCache.set(pkg.identifier, pkg);
      return this.mapPackageFromWeb(pkg);
    });

    return {
      identifier: webOffering.identifier,
      serverDescription: webOffering.serverDescription || '',
      metadata: webOffering.metadata || {},
      availablePackages: packages,
    };
  }

  private mapPackageFromWeb(webPkg: any): Package {
    // purchases-js uses rcBillingProduct for RevenueCat Web Billing products
    const product = webPkg.rcBillingProduct || webPkg.webBillingProduct || webPkg.storeProduct || {};
    const price = product.currentPrice || {};

    return {
      identifier: webPkg.identifier,
      packageType: webPkg.packageType || 'CUSTOM',
      product: {
        identifier: product.identifier || webPkg.identifier,
        description: product.description || '',
        title: product.title || product.identifier || '',
        priceString: price.formattedPrice || `${price.currency || ''} ${price.amount || 0}`,
        price: price.amount || 0,
        currencyCode: price.currency || 'USD',
        productType: 'consumable',
        subscriptionPeriod: product.normalPeriodDuration || null,
        introPrice: undefined,
      },
      offeringIdentifier: webPkg.offeringIdentifier || '',
    };
  }

  private mapCustomerInfoFromWebSDK(webInfo: any): CustomerInfo {
    const entitlements = webInfo.entitlements || {};
    const activeEntitlements: any = {};
    const allEntitlements: any = {};

    const active = entitlements.active || {};
    Object.keys(active).forEach((key) => {
      const mapped = this.mapEntitlementFromWeb(active[key], key);
      activeEntitlements[key] = mapped;
      allEntitlements[key] = mapped;
    });

    const all = entitlements.all || {};
    Object.keys(all).forEach((key) => {
      if (!allEntitlements[key]) {
        allEntitlements[key] = this.mapEntitlementFromWeb(all[key], key);
      }
    });

    const activeSubscriptions = webInfo.activeSubscriptions instanceof Set
      ? Array.from(webInfo.activeSubscriptions as Set<string>)
      : (webInfo.activeSubscriptions || []);

    return {
      originalAppUserId: webInfo.originalAppUserId || '',
      firstSeen: this.dateToString(webInfo.firstSeenDate || webInfo.firstSeen) || '',
      originalPurchaseDate: this.dateToString(webInfo.originalPurchaseDate) || '',
      requestDate: this.dateToString(webInfo.requestDate) || new Date().toISOString(),
      entitlements: {
        active: activeEntitlements,
        all: allEntitlements,
      },
      nonSubscriptions: webInfo.nonSubscriptionTransactions || webInfo.nonSubscriptions || {},
      allPurchaseDates: this.mapDatesRecord(webInfo.allPurchaseDates) as { [key: string]: string },
      allExpirationDates: this.mapDatesRecord(webInfo.allExpirationDates),
      allPurchasedProductIdentifiers: webInfo.allPurchasedProductIdentifiers || [],
      activeSubscriptions: activeSubscriptions as string[],
      allExpirationDatesByProduct: this.mapDatesRecord(webInfo.allExpirationDatesByProduct || {}),
    };
  }

  private mapEntitlementFromWeb(e: any, key: string): any {
    return {
      identifier: e.identifier || key,
      isActive: e.isActive === true,
      willRenew: e.willRenew || false,
      periodType: e.periodType || 'NORMAL',
      latestPurchaseDate: this.dateToString(e.latestPurchaseDate),
      originalPurchaseDate: this.dateToString(e.originalPurchaseDate),
      expirationDate: this.dateToString(e.expirationDate),
      store: typeof e.store === 'string' ? e.store : (e.store?.name || ''),
      productIdentifier: e.productIdentifier || '',
      isSandbox: e.isSandbox || false,
      unsubscribeDetectedAt: this.dateToString(e.unsubscribeDetectedAt),
      billingIssueDetectedAt: this.dateToString(e.billingIssueDetectedAt),
    };
  }

  private dateToString(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
  }

  private mapDatesRecord(record: any): Record<string, string | null> {
    if (!record) return {};
    const result: Record<string, string | null> = {};
    Object.keys(record).forEach((key) => {
      result[key] = this.dateToString(record[key]);
    });
    return result;
  }

  // ─── REST API fallback (web, pre-auth) ──────────────────────────────────────

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

  private mapCustomerInfoFromAPI(apiSubscriber: any): CustomerInfo {
    const entitlements = apiSubscriber.entitlements || {};
    const activeEntitlements: any = {};
    const allEntitlements: any = {};

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

  // ─── Native helpers ──────────────────────────────────────────────────────────

  private async getCurrentAppUserID(): Promise<string> {
    if (!this.currentAppUserID) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'appUserID no configurado. Llama a initialize() o configure() primero.'
      );
    }
    return this.currentAppUserID;
  }

  private getPublicAPIKey(): string {
    if (!this.publicAPIKey) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'API Key no configurada. Llama a initialize() primero.'
      );
    }
    return this.publicAPIKey;
  }

  private ensureInitialized(): void {
    if (!this.isNativePlatform) {
      return;
    }

    if (!this.initialized) {
      throw new PurchasesError(
        PURCHASES_ERROR_CODE.CONFIGURATION_ERROR,
        'RevenueCat no ha sido inicializado. Llama a initialize() primero.'
      );
    }
  }

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

  private mapOfferings(rcOfferings: { current?: PurchasesOfferingType; all: { [key: string]: PurchasesOfferingType } }, module: any): Offerings {
    const mapped: Offerings = {
      all: {},
    };

    Object.keys(rcOfferings.all || {}).forEach((key) => {
      mapped.all[key] = this.mapOffering(rcOfferings.all[key], module);
    });

    if (rcOfferings.current) {
      mapped.current = this.mapOffering(rcOfferings.current, module);
    }

    return mapped;
  }

  private mapOffering(rcOffering: PurchasesOfferingType, module: any): Offering {
    const packages = (rcOffering.availablePackages || []).map((pkg: PurchasesPackageType) => this.mapPackage(pkg));

    const offering: Offering = {
      identifier: rcOffering.identifier,
      serverDescription: rcOffering.serverDescription || '',
      metadata: rcOffering.metadata || {},
      availablePackages: packages,
    };

    if (rcOffering.lifetime) offering.lifetime = this.mapPackage(rcOffering.lifetime);
    if (rcOffering.annual) offering.annual = this.mapPackage(rcOffering.annual);
    if (rcOffering.sixMonth) offering.sixMonth = this.mapPackage(rcOffering.sixMonth);
    if (rcOffering.threeMonth) offering.threeMonth = this.mapPackage(rcOffering.threeMonth);
    if (rcOffering.twoMonth) offering.twoMonth = this.mapPackage(rcOffering.twoMonth);
    if (rcOffering.monthly) offering.monthly = this.mapPackage(rcOffering.monthly);
    if (rcOffering.weekly) offering.weekly = this.mapPackage(rcOffering.weekly);

    return offering;
  }

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
