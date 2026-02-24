/**
 * Códigos de error de RevenueCat
 */
export enum PURCHASES_ERROR_CODE {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  PURCHASE_CANCELLED = 'PURCHASE_CANCELLED',
  STORE_PROBLEM = 'STORE_PROBLEM',
  PURCHASE_NOT_ALLOWED = 'PURCHASE_NOT_ALLOWED',
  PURCHASE_INVALID = 'PURCHASE_INVALID',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE = 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE',
  PRODUCT_ALREADY_PURCHASED = 'PRODUCT_ALREADY_PURCHASED',
  RECEIPT_ALREADY_IN_USE = 'RECEIPT_ALREADY_IN_USE',
  INVALID_RECEIPT = 'INVALID_RECEIPT',
  MISSING_RECEIPT_FILE = 'MISSING_RECEIPT_FILE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_APP_USER_ID = 'INVALID_APP_USER_ID',
  OPERATION_ALREADY_IN_PROGRESS_FOR_PRODUCT = 'OPERATION_ALREADY_IN_PROGRESS_FOR_PRODUCT',
  UNKNOWN_BACKEND_ERROR = 'UNKNOWN_BACKEND_ERROR',
  INVALID_SUBSCRIBER_ATTRIBUTES = 'INVALID_SUBSCRIBER_ATTRIBUTES',
  LOG_OUT_ANONYMOUS_USER_ERROR = 'LOG_OUT_ANONYMOUS_USER_ERROR',
  RECEIPT_ALREADY_IN_USE_BY_OTHER_SUBSCRIBER = 'RECEIPT_ALREADY_IN_USE_BY_OTHER_SUBSCRIBER',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNSUPPORTED_ERROR = 'UNSUPPORTED_ERROR',
  EMPTY_SUBSCRIBER_ATTRIBUTES = 'EMPTY_SUBSCRIBER_ATTRIBUTES',
  PRODUCT_DISCOUNT_MISSING_IDENTIFIER = 'PRODUCT_DISCOUNT_MISSING_IDENTIFIER',
}

/**
 * Error personalizado de RevenueCat
 */
export class PurchasesError extends Error {
  constructor(
    public code: PURCHASES_ERROR_CODE,
    message: string,
    public underlyingErrorMessage?: string
  ) {
    super(message);
    this.name = 'PurchasesError';
    Object.setPrototypeOf(this, PurchasesError.prototype);
  }
}

/**
 * Convierte un error de RevenueCat a PurchasesError
 */
export function mapRevenueCatError(error: any): PurchasesError {
  const errorCode = error.code || PURCHASES_ERROR_CODE.UNKNOWN_ERROR;
  const errorMessage = error.message || 'Error desconocido';
  const underlyingMessage = error.underlyingErrorMessage;

  return new PurchasesError(
    errorCode as PURCHASES_ERROR_CODE,
    errorMessage,
    underlyingMessage
  );
}

/**
 * Verifica si un error es un PurchasesError
 */
export function isPurchasesError(error: any): error is PurchasesError {
  return error instanceof PurchasesError || error?.code !== undefined;
}
