import { Injectable } from '@angular/core';

export interface RandomNumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  exclude?: number[]; // Números a excluir
}

@Injectable({
  providedIn: 'root'
})
export class RandomNumberService {

  /**
   * Genera un número aleatorio simple (compatible con randomNumber anterior)
   * @returns Número aleatorio entre 0 y 9999
   */
  generateRandomNumber(): number {
    return Math.floor(Math.random() * 10000);
  }

  /**
   * Genera un número aleatorio en un rango específico
   * @param min Valor mínimo (inclusive)
   * @param max Valor máximo (inclusive)
   * @returns Número aleatorio en el rango
   */
  generateInRange(min: number, max: number): number {
    if (min > max) {
      throw new Error('El valor mínimo no puede ser mayor que el máximo');
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Genera un número decimal aleatorio en un rango
   * @param min Valor mínimo
   * @param max Valor máximo
   * @param decimals Número de decimales (por defecto 2)
   * @returns Número decimal aleatorio
   */
  generateDecimal(min: number, max: number, decimals: number = 2): number {
    if (min > max) {
      throw new Error('El valor mínimo no puede ser mayor que el máximo');
    }
    const random = Math.random() * (max - min) + min;
    return parseFloat(random.toFixed(decimals));
  }

  /**
   * Genera un número aleatorio con opciones avanzadas
   * @param options Opciones de generación
   * @returns Número aleatorio
   */
  generateWithOptions(options: RandomNumberOptions = {}): number {
    const { min = 0, max = 10000, integer = true } = options;

    let number: number;

    if (integer) {
      number = this.generateInRange(min, max);
    } else {
      number = this.generateDecimal(min, max);
    }

    // Excluir números específicos si se solicitan
    if (options.exclude && options.exclude.length > 0) {
      const maxAttempts = 1000;
      let attempts = 0;
      
      while (options.exclude.includes(number) && attempts < maxAttempts) {
        if (integer) {
          number = this.generateInRange(min, max);
        } else {
          number = this.generateDecimal(min, max);
        }
        attempts++;
      }

      // Si se alcanzó el límite de intentos, lanzar error
      if (attempts >= maxAttempts) {
        throw new Error('No se pudo generar un número que no esté en la lista de exclusiones');
      }
    }

    return number;
  }

  /**
   * Genera múltiples números aleatorios únicos
   * @param count Número de elementos a generar
   * @param min Valor mínimo
   * @param max Valor máximo
   * @returns Array de números únicos
   */
  generateUnique(count: number, min: number, max: number): number[] {
    if (count > (max - min + 1)) {
      throw new Error('No se pueden generar más números únicos de los disponibles en el rango');
    }

    const numbers: Set<number> = new Set();
    
    while (numbers.size < count) {
      numbers.add(this.generateInRange(min, max));
    }

    return Array.from(numbers);
  }

  /**
   * Genera un array de números aleatorios
   * @param count Número de elementos a generar
   * @param options Opciones de generación
   * @returns Array de números aleatorios
   */
  generateArray(count: number, options: RandomNumberOptions = {}): number[] {
    const numbers: number[] = [];
    
    for (let i = 0; i < count; i++) {
      numbers.push(this.generateWithOptions(options));
    }

    return numbers;
  }

  /**
   * Genera un número aleatorio basado en una distribución normal (campana de Gauss)
   * @param mean Media
   * @param stdDev Desviación estándar
   * @returns Número con distribución normal
   */
  generateNormal(mean: number, stdDev: number): number {
    // Algoritmo de Box-Muller para generar distribución normal
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Genera un número aleatorio basado en una distribución ponderada
   * @param weights Array de pesos
   * @returns Índice seleccionado
   */
  generateWeighted(weights: number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return i;
      }
    }
    
    return weights.length - 1;
  }

  /**
   * Genera un color hexadecimal aleatorio
   * @returns Color en formato #RRGGBB
   */
  generateColor(): string {
    const r = this.generateInRange(0, 255);
    const g = this.generateInRange(0, 255);
    const b = this.generateInRange(0, 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Genera un color hexadecimal aleatorio con formato específico
   * @param format Formato: 'rgb', 'rgba', 'hex'
   * @param opacity Opacidad para rgba (0-1)
   * @returns Color en el formato especificado
   */
  generateColorFormatted(format: 'rgb' | 'rgba' | 'hex' = 'hex', opacity: number = 1): string {
    const r = this.generateInRange(0, 255);
    const g = this.generateInRange(0, 255);
    const b = this.generateInRange(0, 255);

    switch (format) {
      case 'rgb':
        return `rgb(${r}, ${g}, ${b})`;
      case 'rgba':
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      case 'hex':
      default:
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }

  /**
   * Mezcla aleatoriamente un array de elementos
   * @param array Array a mezclar
   * @returns Nuevo array mezclado
   */
  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Selecciona un elemento aleatorio de un array
   * @param array Array del cual seleccionar
   * @returns Elemento seleccionado
   */
  pickRandom<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('El array está vacío');
    }
    const index = this.generateInRange(0, array.length - 1);
    return array[index];
  }

  /**
   * Selecciona múltiples elementos aleatorios de un array
   * @param array Array del cual seleccionar
   * @param count Número de elementos a seleccionar
   * @param allowDuplicate Si permite duplicados
   * @returns Array de elementos seleccionados
   */
  pickMultiple<T>(array: T[], count: number, allowDuplicate: boolean = false): T[] {
    if (array.length === 0) {
      throw new Error('El array está vacío');
    }

    if (!allowDuplicate && count > array.length) {
      throw new Error('No se pueden seleccionar más elementos únicos de los disponibles');
    }

    if (allowDuplicate) {
      const result: T[] = [];
      for (let i = 0; i < count; i++) {
        result.push(this.pickRandom(array));
      }
      return result;
    } else {
      const shuffled = this.shuffle(array);
      return shuffled.slice(0, count);
    }
  }

  /**
   * Valida si un valor está en un rango
   * @param value Valor a validar
   * @param min Valor mínimo
   * @param max Valor máximo
   * @returns true si está en el rango
   */
  isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Calcula estadísticas de un array de números
   * @param numbers Array de números
   * @returns Objeto con estadísticas (min, max, avg, sum, count)
   */
  calculateStats(numbers: number[]): {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  } {
    if (numbers.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }

    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      avg: sum / numbers.length,
      sum,
      count: numbers.length
    };
  }
}

