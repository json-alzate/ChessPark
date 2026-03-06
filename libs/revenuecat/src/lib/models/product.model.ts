/**
 * Modelo que representa un producto disponible en RevenueCat
 */
export interface Product {
  /** Identificador único del producto */
  identifier: string;
  /** Descripción del producto */
  description: string;
  /** Título del producto */
  title: string;
  /** Precio formateado como string (ej: "$9.99") */
  priceString: string;
  /** Precio numérico */
  price: number;
  /** Código de moneda (ej: "USD", "EUR") */
  currencyCode: string;
  /** Tipo de producto: subscription, consumable, non_consumable */
  productType: 'subscription' | 'consumable' | 'non_consumable';
  /** Período de suscripción si es subscription (ej: "P1M" para mensual) */
  subscriptionPeriod?: string;
  /** Período de prueba gratuita si aplica */
  introPrice?: IntroPrice;
}

/**
 * Precio de introducción (trial o promotional)
 */
export interface IntroPrice {
  /** Precio formateado */
  priceString: string;
  /** Precio numérico */
  price: number;
  /** Período (ej: "P7D" para 7 días) */
  period: string;
  /** Ciclos de período */
  cycles: number;
}
