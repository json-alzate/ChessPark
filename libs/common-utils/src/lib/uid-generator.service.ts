import { Injectable } from '@angular/core';

export interface UidGenerationOptions {
  length?: number;        // Longitud del UID (por defecto 27 caracteres)
  prefix?: string;        // Prefijo opcional para el UID
  suffix?: string;        // Sufijo opcional para el UID
  includeTimestamp?: boolean; // Incluir timestamp en el UID
  includeRandomChars?: number; // Número de caracteres aleatorios adicionales
}

@Injectable({
  providedIn: 'root'
})
export class UidGeneratorService {

  private readonly DEFAULT_LENGTH = 27;
  private readonly CHAR_SET_ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private readonly CHAR_SET_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz0123456789';
  private readonly CHAR_SET_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private readonly CHAR_SET_NUMERIC = '0123456789';
  private readonly CHAR_SET_ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /**
   * Genera un UID único basado en Math.random (compatible con versión antigua)
   * @param options Opciones de generación
   * @returns UID string
   */
  generateUid(options: UidGenerationOptions = {}): string {
    const length = options.length ?? this.DEFAULT_LENGTH;
    const randomPart = this.generateRandomPart(length);

    let uid = randomPart;

    // Agregar prefijo si se especifica
    if (options.prefix) {
      uid = `${options.prefix}-${uid}`;
    }

    // Agregar timestamp si se solicita
    if (options.includeTimestamp) {
      uid = `${uid}-${Date.now()}`;
    }

    // Agregar caracteres aleatorios adicionales
    if (options.includeRandomChars && options.includeRandomChars > 0) {
      uid += this.generateRandomPart(options.includeRandomChars);
    }

    // Agregar sufijo si se especifica
    if (options.suffix) {
      uid = `${uid}-${options.suffix}`;
    }

    return uid;
  }

  /**
   * Genera un UID simple (compatible con createUid anterior)
   * @returns UID string de 27 caracteres
   */
  generateSimpleUid(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Genera un UID corto
   * @param length Longitud deseada (por defecto 8)
   * @returns UID string corto
   */
  generateShortUid(length: number = 8): string {
    return this.generateRandomPart(length);
  }

  /**
   * Genera un UID largo con timestamp
   * @returns UID string largo con timestamp
   */
  generateLongUid(): string {
    const timestamp = Date.now();
    const randomPart = this.generateRandomPart(16);
    const randomExtra = this.generateRandomPart(8);
    return `${timestamp}-${randomPart}-${randomExtra}`;
  }

  /**
   * Genera un UID numérico
   * @param length Longitud deseada (por defecto 10)
   * @returns UID numérico
   */
  generateNumericUid(length: number = 10): string {
    return this.generateRandomPart(length, this.CHAR_SET_NUMERIC);
  }

  /**
   * Genera un UID alfanumérico
   * @param length Longitud deseada (por defecto 16)
   * @param uppercase Si debe usar solo mayúsculas
   * @returns UID alfanumérico
   */
  generateAlphanumericUid(length: number = 16, uppercase: boolean = false): string {
    const charSet = uppercase ? this.CHAR_SET_UPPERCASE : this.CHAR_SET_ALPHANUMERIC;
    return this.generateRandomPart(length, charSet);
  }

  /**
   * Genera un UID con formato UUID-like
   * @returns UID con formato XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */
  generateUuidLike(): string {
    const parts = [
      this.generateRandomPart(8),
      this.generateRandomPart(4),
      this.generateRandomPart(4),
      this.generateRandomPart(4),
      this.generateRandomPart(12)
    ];
    return parts.join('-');
  }

  /**
   * Genera un prefijo temporal para UIDs
   * @returns Prefijo basado en fecha (YYYYMMDD)
   */
  generateDatePrefix(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Genera un prefijo temporal para UIDs con hora
   * @returns Prefijo basado en fecha y hora (YYYYMMDDHHmmss)
   */
  generateTimestampPrefix(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Genera múltiples UIDs únicos
   * @param count Número de UIDs a generar
   * @param options Opciones de generación
   * @returns Array de UIDs
   */
  generateMultipleUids(count: number, options: UidGenerationOptions = {}): string[] {
    const uids: string[] = [];
    const generated = new Set<string>();

    while (uids.length < count) {
      const uid = this.generateUid(options);
      if (!generated.has(uid)) {
        generated.add(uid);
        uids.push(uid);
      }
    }

    return uids;
  }

  /**
   * Valida si un UID tiene el formato correcto
   * @param uid UID a validar
   * @returns true si es válido
   */
  isValidUid(uid: string): boolean {
    return typeof uid === 'string' && uid.length > 0;
  }

  /**
   * Extrae el timestamp de un UID si lo contiene
   * @param uid UID que contiene timestamp
   * @returns Timestamp o null si no se encuentra
   */
  extractTimestamp(uid: string): number | null {
    const match = uid.match(/-(\d{13})-/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Compara dos UIDs
   * @param uid1 Primer UID
   * @param uid2 Segundo UID
   * @returns true si son iguales
   */
  areEqual(uid1: string, uid2: string): boolean {
    return uid1 === uid2;
  }

  private generateRandomPart(length: number, charSet: string = this.CHAR_SET_LOWERCASE): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charSet.charAt(Math.floor(Math.random() * charSet.length));
    }
    return result;
  }
}

