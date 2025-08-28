import { Injectable } from '@angular/core';

export interface DateFormatOptions {
  locale?: string;
  format?: 'short' | 'medium' | 'long' | 'full';
  timeZone?: string;
}

export interface RelativeTimeOptions {
  includeSeconds?: boolean;
  addSuffix?: boolean;
  locale?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DateUtilsService {

  private readonly defaultLocale = 'es-ES';
  private readonly defaultTimeZone = 'Europe/Madrid';

  /**
   * Formatea una fecha en formato legible
   * @param date Fecha a formatear
   * @param options Opciones de formato
   * @returns Fecha formateada como string
   */
  formatDate(date: Date | string | number, options?: DateFormatOptions): string {
    const dateObj = this.toDate(date);
    const locale = options?.locale || this.defaultLocale;
    const format = options?.format || 'medium';
    const timeZone = options?.timeZone || this.defaultTimeZone;

    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone,
      ...this.getFormatOptions(format)
    };

    return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
  }

  /**
   * Obtiene el tiempo relativo desde una fecha
   * @param date Fecha de referencia
   * @param options Opciones de formato
   * @returns Tiempo relativo como string
   */
  getRelativeTime(date: Date | string | number, options?: RelativeTimeOptions): string {
    const dateObj = this.toDate(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return options?.includeSeconds ? `${diffInSeconds} segundos` : 'hace un momento';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return diffInMinutes === 1 ? 'hace 1 minuto' : `hace ${diffInMinutes} minutos`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return diffInHours === 1 ? 'hace 1 hora' : `hace ${diffInHours} horas`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return diffInDays === 1 ? 'hace 1 día' : `hace ${diffInDays} días`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return diffInWeeks === 1 ? 'hace 1 semana' : `hace ${diffInWeeks} semanas`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return diffInMonths === 1 ? 'hace 1 mes' : `hace ${diffInMonths} meses`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return diffInYears === 1 ? 'hace 1 año' : `hace ${diffInYears} años`;
  }

  /**
   * Verifica si una fecha es hoy
   * @param date Fecha a verificar
   * @returns true si es hoy
   */
  isToday(date: Date | string | number): boolean {
    const dateObj = this.toDate(date);
    const today = new Date();
    
    return dateObj.getDate() === today.getDate() &&
           dateObj.getMonth() === today.getMonth() &&
           dateObj.getFullYear() === today.getFullYear();
  }

  /**
   * Verifica si una fecha es ayer
   * @param date Fecha a verificar
   * @returns true si es ayer
   */
  isYesterday(date: Date | string | number): boolean {
    const dateObj = this.toDate(date);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return dateObj.getDate() === yesterday.getDate() &&
           dateObj.getMonth() === yesterday.getMonth() &&
           dateObj.getFullYear() === yesterday.getFullYear();
  }

  /**
   * Verifica si una fecha es esta semana
   * @param date Fecha a verificar
   * @returns true si es esta semana
   */
  isThisWeek(date: Date | string | number): boolean {
    const dateObj = this.toDate(date);
    const now = new Date();
    const startOfWeek = this.getStartOfWeek(now);
    const endOfWeek = this.getEndOfWeek(now);
    
    return dateObj >= startOfWeek && dateObj <= endOfWeek;
  }

  /**
   * Verifica si una fecha es este mes
   * @param date Fecha a verificar
   * @returns true si es este mes
   */
  isThisMonth(date: Date | string | number): boolean {
    const dateObj = this.toDate(date);
    const now = new Date();
    
    return dateObj.getMonth() === now.getMonth() &&
           dateObj.getFullYear() === now.getFullYear();
  }

  /**
   * Obtiene el inicio de la semana para una fecha
   * @param date Fecha de referencia
   * @returns Fecha del inicio de la semana
   */
  getStartOfWeek(date: Date): Date {
    const dateObj = new Date(date);
    const day = dateObj.getDay();
    const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para que la semana empiece en lunes
    dateObj.setDate(diff);
    dateObj.setHours(0, 0, 0, 0);
    return dateObj;
  }

  /**
   * Obtiene el final de la semana para una fecha
   * @param date Fecha de referencia
   * @returns Fecha del final de la semana
   */
  getEndOfWeek(date: Date): Date {
    const startOfWeek = this.getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  }

  /**
   * Obtiene el inicio del mes para una fecha
   * @param date Fecha de referencia
   * @returns Fecha del inicio del mes
   */
  getStartOfMonth(date: Date): Date {
    const dateObj = new Date(date);
    dateObj.setDate(1);
    dateObj.setHours(0, 0, 0, 0);
    return dateObj;
  }

  /**
   * Obtiene el final del mes para una fecha
   * @param date Fecha de referencia
   * @returns Fecha del final del mes
   */
  getEndOfMonth(date: Date): Date {
    const dateObj = new Date(date);
    dateObj.setMonth(dateObj.getMonth() + 1, 0);
    dateObj.setHours(23, 59, 59, 999);
    return dateObj;
  }

  /**
   * Calcula la diferencia entre dos fechas
   * @param date1 Primera fecha
   * @param date2 Segunda fecha
   * @returns Objeto con las diferencias en diferentes unidades
   */
  getDateDifference(date1: Date | string | number, date2: Date | string | number) {
    const d1 = this.toDate(date1);
    const d2 = this.toDate(date2);
    const diffInMs = Math.abs(d2.getTime() - d1.getTime());

    return {
      milliseconds: diffInMs,
      seconds: Math.floor(diffInMs / 1000),
      minutes: Math.floor(diffInMs / (1000 * 60)),
      hours: Math.floor(diffInMs / (1000 * 60 * 60)),
      days: Math.floor(diffInMs / (1000 * 60 * 60 * 24)),
      weeks: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7)),
      months: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30.44)),
      years: Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365.25))
    };
  }

  /**
   * Formatea una duración en formato legible
   * @param milliseconds Duración en milisegundos
   * @param includeSeconds Si incluir segundos
   * @returns Duración formateada
   */
  formatDuration(milliseconds: number, includeSeconds: boolean = true): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} día${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    } else if (includeSeconds && seconds > 0) {
      return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    } else {
      return 'menos de 1 minuto';
    }
  }

  /**
   * Convierte diferentes tipos de entrada a Date
   * @param input Entrada a convertir
   * @returns Objeto Date
   */
  private toDate(input: Date | string | number): Date {
    if (input instanceof Date) {
      return input;
    } else if (typeof input === 'string') {
      return new Date(input);
    } else {
      return new Date(input);
    }
  }

  /**
   * Obtiene las opciones de formato para Intl.DateTimeFormat
   * @param format Tipo de formato
   * @returns Opciones de formato
   */
  private getFormatOptions(format: string): Intl.DateTimeFormatOptions {
    switch (format) {
      case 'short':
        return { dateStyle: 'short', timeStyle: 'short' };
      case 'medium':
        return { dateStyle: 'medium', timeStyle: 'short' };
      case 'long':
        return { dateStyle: 'long', timeStyle: 'short' };
      case 'full':
        return { dateStyle: 'full', timeStyle: 'full' };
      default:
        return { dateStyle: 'medium', timeStyle: 'short' };
    }
  }
}

