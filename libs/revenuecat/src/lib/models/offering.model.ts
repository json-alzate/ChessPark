import { Product } from './product.model';

/**
 * Modelo que representa un Package en RevenueCat
 */
export interface Package {
  /** Identificador del package */
  identifier: string;
  /** Tipo de package (monthly, annual, weekly, etc.) */
  packageType: string;
  /** Producto asociado */
  product: Product;
  /** Precio formateado */
  offeringIdentifier: string;
}

/**
 * Modelo que representa un Offering en RevenueCat
 */
export interface Offering {
  /** Identificador único del offering */
  identifier: string;
  /** Descripción del offering */
  serverDescription: string;
  /** Metadata adicional */
  metadata: { [key: string]: string };
  /** Packages disponibles en este offering */
  availablePackages: Package[];
  /** Lifetime package si existe */
  lifetime?: Package;
  /** Annual package si existe */
  annual?: Package;
  /** SixMonth package si existe */
  sixMonth?: Package;
  /** ThreeMonth package si existe */
  threeMonth?: Package;
  /** TwoMonth package si existe */
  twoMonth?: Package;
  /** Monthly package si existe */
  monthly?: Package;
  /** Weekly package si existe */
  weekly?: Package;
}

/**
 * Modelo que representa las ofertas disponibles
 */
export interface Offerings {
  /** Offering actual (default) */
  current?: Offering;
  /** Todos los offerings disponibles */
  all: { [key: string]: Offering };
}
