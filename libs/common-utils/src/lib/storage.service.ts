import { Injectable } from '@angular/core';

export type StorageType = 'local' | 'session';

export interface StorageOptions {
  type?: StorageType;
  encrypt?: boolean;
  ttl?: number; // Time to live en milisegundos
}

export interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  ttl?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly encryptionKey = 'chesspark_encryption_key_2024';
  private readonly prefix = 'chesspark_';

  /**
   * Guarda un valor en el almacenamiento
   * @param key Clave del valor
   * @param value Valor a guardar
   * @param options Opciones de almacenamiento
   */
  set<T>(key: string, value: T, options: StorageOptions = {}): void {
    const { type = 'local', encrypt = false, ttl } = options;
    const storage = this.getStorage(type);
    const fullKey = this.getFullKey(key);

    const item: StorageItem<T> = {
      value,
      timestamp: Date.now(),
      ttl
    };

    let dataToStore: string;
    if (encrypt) {
      dataToStore = this.encrypt(JSON.stringify(item));
    } else {
      dataToStore = JSON.stringify(item);
    }

    try {
      storage.setItem(fullKey, dataToStore);
    } catch (error) {
      console.error('Error al guardar en almacenamiento:', error);
      // Si el almacenamiento está lleno, intentar limpiar elementos expirados
      this.cleanupExpiredItems(type);
      try {
        storage.setItem(fullKey, dataToStore);
      } catch (retryError) {
        console.error('Error al reintentar guardar:', retryError);
      }
    }
  }

  /**
   * Obtiene un valor del almacenamiento
   * @param key Clave del valor
   * @param options Opciones de almacenamiento
   * @returns Valor almacenado o null si no existe o expiró
   */
  get<T>(key: string, options: StorageOptions = {}): T | null {
    const { type = 'local', encrypt = false } = options;
    const storage = this.getStorage(type);
    const fullKey = this.getFullKey(key);

    try {
      const storedData = storage.getItem(fullKey);
      if (!storedData) return null;

      let item: StorageItem<T>;
      if (encrypt) {
        const decrypted = this.decrypt(storedData);
        item = JSON.parse(decrypted);
      } else {
        item = JSON.parse(storedData);
      }

      // Verificar si el elemento expiró
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        this.remove(key, options);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Error al obtener del almacenamiento:', error);
      return null;
    }
  }

  /**
   * Verifica si existe una clave en el almacenamiento
   * @param key Clave a verificar
   * @param options Opciones de almacenamiento
   * @returns true si existe y no expiró
   */
  has(key: string, options: StorageOptions = {}): boolean {
    const { type = 'local' } = options;
    const storage = this.getStorage(type);
    const fullKey = this.getFullKey(key);

    try {
      const storedData = storage.getItem(fullKey);
      if (!storedData) return false;

      const item: StorageItem = JSON.parse(storedData);
      
      // Verificar si expiró
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        this.remove(key, options);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Elimina un valor del almacenamiento
   * @param key Clave del valor a eliminar
   * @param options Opciones de almacenamiento
   */
  remove(key: string, options: StorageOptions = {}): void {
    const { type = 'local' } = options;
    const storage = this.getStorage(type);
    const fullKey = this.getFullKey(key);

    try {
      storage.removeItem(fullKey);
    } catch (error) {
      console.error('Error al eliminar del almacenamiento:', error);
    }
  }

  /**
   * Limpia todo el almacenamiento de un tipo específico
   * @param type Tipo de almacenamiento
   * @param pattern Patrón opcional para filtrar claves
   */
  clear(type: StorageType = 'local', pattern?: string): void {
    const storage = this.getStorage(type);
    const keysToRemove: string[] = [];

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          if (!pattern || key.includes(pattern)) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => storage.removeItem(key));
    } catch (error) {
      console.error('Error al limpiar almacenamiento:', error);
    }
  }

  /**
   * Obtiene todas las claves del almacenamiento
   * @param type Tipo de almacenamiento
   * @param pattern Patrón opcional para filtrar claves
   * @returns Array de claves
   */
  keys(type: StorageType = 'local', pattern?: string): string[] {
    const storage = this.getStorage(type);
    const keys: string[] = [];

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const cleanKey = key.replace(this.prefix, '');
          if (!pattern || cleanKey.includes(pattern)) {
            keys.push(cleanKey);
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener claves:', error);
    }

    return keys;
  }

  /**
   * Obtiene el tamaño del almacenamiento en bytes
   * @param type Tipo de almacenamiento
   * @returns Tamaño en bytes
   */
  getSize(type: StorageType = 'local'): number {
    const storage = this.getStorage(type);
    let size = 0;

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const value = storage.getItem(key);
          if (value) {
            size += key.length + value.length;
          }
        }
      }
    } catch (error) {
      console.error('Error al calcular tamaño:', error);
    }

    return size;
  }

  /**
   * Obtiene información sobre el almacenamiento
   * @param type Tipo de almacenamiento
   * @returns Información del almacenamiento
   */
  getInfo(type: StorageType = 'local'): {
    totalKeys: number;
    totalSize: number;
    availableSpace: number;
    usedSpace: number;
  } {
    const storage = this.getStorage(type);
    const totalKeys = this.keys(type).length;
    const totalSize = this.getSize(type);
    
    // Estimación del espacio disponible (localStorage típicamente 5-10MB)
    const estimatedAvailable = type === 'local' ? 5 * 1024 * 1024 : 5 * 1024 * 1024;
    const availableSpace = Math.max(0, estimatedAvailable - totalSize);

    return {
      totalKeys,
      totalSize,
      availableSpace,
      usedSpace: totalSize
    };
  }

  /**
   * Limpia elementos expirados del almacenamiento
   * @param type Tipo de almacenamiento
   */
  private cleanupExpiredItems(type: StorageType): void {
    const storage = this.getStorage(type);
    const keysToRemove: string[] = [];

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          try {
            const storedData = storage.getItem(key);
            if (storedData) {
              const item: StorageItem = JSON.parse(storedData);
              if (item.ttl && Date.now() - item.timestamp > item.ttl) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // Si no se puede parsear, eliminar
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => storage.removeItem(key));
    } catch (error) {
      console.error('Error al limpiar elementos expirados:', error);
    }
  }

  /**
   * Obtiene el almacenamiento según el tipo
   * @param type Tipo de almacenamiento
   * @returns Objeto Storage
   */
  private getStorage(type: StorageType): Storage {
    return type === 'local' ? localStorage : sessionStorage;
  }

  /**
   * Obtiene la clave completa con prefijo
   * @param key Clave base
   * @returns Clave completa
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Encripta un string
   * @param text Texto a encriptar
   * @returns Texto encriptado
   */
  private encrypt(text: string): string {
    // Implementación simple de encriptación (en producción usar algo más robusto)
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(result);
  }

  /**
   * Desencripta un string
   * @param encryptedText Texto encriptado
   * @returns Texto desencriptado
   */
  private decrypt(encryptedText: string): string {
    try {
      const decoded = atob(encryptedText);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch {
      return '';
    }
  }
}

