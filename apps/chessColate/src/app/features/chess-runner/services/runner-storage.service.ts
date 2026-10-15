import { Injectable } from '@angular/core';

/**
 * Lo único que el Chess Runner recuerda en el dispositivo: si el usuario ya vio la explicación de las
 * mecánicas. La primera vez se enseña completa; después, la carrera arranca sin más.
 */
@Injectable({ providedIn: 'root' })
export class RunnerStorageService {
  private readonly TUTORIAL_KEY = 'chessColate_runner_tutorial_seen';

  isTutorialSeen(): boolean {
    try {
      return localStorage.getItem(this.TUTORIAL_KEY) === 'true';
    } catch {
      // Sin acceso al almacenamiento no se insiste con el tutorial cada vez
      return true;
    }
  }

  markTutorialSeen(): void {
    try {
      localStorage.setItem(this.TUTORIAL_KEY, 'true');
    } catch (error) {
      console.error('Error al guardar que se vio el tutorial del runner:', error);
    }
  }
}
