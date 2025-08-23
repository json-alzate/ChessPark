import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';

export interface ConfettiOptions {
  startVelocity?: number;
  spread?: number;
  ticks?: number;
  zIndex?: number;
  colors?: string[];
  particleCount?: number;
  origin?: { x: number; y: number };
}

export interface ConfettiTheme {
  colors: string[];
  duration: number;
  intensity: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class ConfettiService {

  private readonly defaultOptions: ConfettiOptions = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0
  };

  private readonly themes: Record<string, ConfettiTheme> = {
    gold: {
      colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'],
      duration: 3000,
      intensity: 'medium'
    },
    white: {
      colors: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
      duration: 3000,
      intensity: 'medium'
    },
    black: {
      colors: ['#000000', '#1a1a1a', '#333333', '#4d4d4d'],
      duration: 3000,
      intensity: 'medium'
    },
    rainbow: {
      colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
      duration: 4000,
      intensity: 'high'
    },
    celebration: {
      colors: ['#FFD700', '#FF69B4', '#00CED1', '#32CD32', '#FF4500'],
      duration: 5000,
      intensity: 'high'
    }
  };

  /**
   * Lanza confetti con un tema predefinido
   * @param theme Nombre del tema a usar
   * @param options Opciones adicionales de configuración
   */
  launchTheme(theme: string, options?: Partial<ConfettiOptions>): void {
    const selectedTheme = this.themes[theme] || this.themes['gold'];
    this.launch(selectedTheme.colors, selectedTheme.duration, selectedTheme.intensity, options);
  }

  /**
   * Lanza confetti personalizado
   * @param colors Array de colores para el confetti
   * @param duration Duración en milisegundos
   * @param intensity Intensidad del efecto
   * @param options Opciones adicionales de configuración
   */
  launch(
    colors: string[],
    duration: number = 3000,
    intensity: 'low' | 'medium' | 'high' = 'medium',
    options?: Partial<ConfettiOptions>
  ): void {
    const intensityMultiplier = {
      low: 0.5,
      medium: 1,
      high: 1.5
    };

    const multiplier = intensityMultiplier[intensity];
    const animationEnd = Date.now() + duration;
    const defaults: ConfettiOptions = {
      ...this.defaultOptions,
      colors,
      ...options
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = Math.floor(50 * multiplier * (timeLeft / duration));

      // Confetti desde la izquierda
      confetti({
        ...defaults,
        particleCount,
        origin: { x: this.randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      // Confetti desde la derecha
      confetti({
        ...defaults,
        particleCount,
        origin: { x: this.randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });

      // Confetti desde el centro
      confetti({
        ...defaults,
        particleCount: Math.floor(particleCount * 0.5),
        origin: { x: this.randomInRange(0.4, 0.6), y: Math.random() - 0.2 }
      });

      // Confetti extra para alta intensidad
      if (intensity === 'high') {
        confetti({
          ...defaults,
          particleCount: Math.floor(particleCount * 0.3),
          origin: { x: this.randomInRange(0.2, 0.8), y: Math.random() - 0.1 }
        });
      }
    }, 250);
  }

  /**
   * Lanza confetti desde una posición específica
   * @param x Posición X (0-1)
   * @param y Posición Y (0-1)
   * @param colors Colores del confetti
   * @param options Opciones adicionales
   */
  launchFromPosition(
    x: number,
    y: number,
    colors: string[] = this.themes['gold'].colors,
    options?: Partial<ConfettiOptions>
  ): void {
    const defaults: ConfettiOptions = {
      ...this.defaultOptions,
      colors,
      particleCount: 100,
      origin: { x, y },
      ...options
    };

    confetti(defaults);
  }

  /**
   * Lanza confetti en forma de explosión
   * @param colors Colores del confetti
   * @param options Opciones adicionales
   */
  launchExplosion(
    colors: string[] = this.themes['celebration'].colors,
    options?: Partial<ConfettiOptions>
  ): void {
    const defaults: ConfettiOptions = {
      ...this.defaultOptions,
      colors,
      spread: 360,
      startVelocity: 45,
      ...options
    };

    // Explosión central
    confetti({
      ...defaults,
      particleCount: 100,
      origin: { x: 0.5, y: 0.5 }
    });

    // Explosiones laterales
    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.2, y: 0.5 }
    });

    confetti({
      ...defaults,
      particleCount: 50,
      origin: { x: 0.8, y: 0.5 }
    });
  }

  /**
   * Lanza confetti en cascada
   * @param colors Colores del confetti
   * @param options Opciones adicionales
   */
  launchCascade(
    colors: string[] = this.themes['rainbow'].colors,
    options?: Partial<ConfettiOptions>
  ): void {
    const duration = 4000;
    const animationEnd = Date.now() + duration;
    const defaults: ConfettiOptions = {
      ...this.defaultOptions,
      colors,
      startVelocity: 20,
      ...options
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = Math.floor(30 * (timeLeft / duration));

      // Cascada desde arriba
      for (let i = 0; i < 5; i++) {
        confetti({
          ...defaults,
          particleCount: Math.floor(particleCount / 5),
          origin: { x: (i + 1) / 6, y: 0 }
        });
      }
    }, 100);
  }

  /**
   * Detiene todos los efectos de confetti activos
   */
  stop(): void {
    // Limpia el canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  /**
   * Genera un número aleatorio en un rango
   * @param min Valor mínimo
   * @param max Valor máximo
   * @returns Número aleatorio
   */
  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Obtiene la lista de temas disponibles
   * @returns Array de nombres de temas
   */
  getAvailableThemes(): string[] {
    return Object.keys(this.themes);
  }

  /**
   * Obtiene un tema específico
   * @param themeName Nombre del tema
   * @returns Tema o undefined si no existe
   */
  getTheme(themeName: string): ConfettiTheme | undefined {
    return this.themes[themeName];
  }
}
