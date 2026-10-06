import { Injectable } from '@angular/core';
import { Plan } from '@cpark/models';

@Injectable({
  providedIn: 'root',
})
export class PlanStorageService {
  private readonly STORAGE_KEY = 'chessColate_plans_history';

  /**
   * Guarda un plan completado en localStorage
   */
  savePlan(plan: Plan): void {
    if (!plan.isFinished) {
      console.warn('Intento de guardar un plan que no está completado');
      return;
    }

    const plans = this.getAllPlans();
    
    // Verificar si el plan ya existe (por uid) y actualizarlo, o agregarlo
    const existingIndex = plans.findIndex(p => p.uid === plan.uid);
    
    if (existingIndex >= 0) {
      plans[existingIndex] = plan;
    } else {
      plans.push(plan);
    }

    // Ordenar por fecha (más recientes primero)
    plans.sort((a, b) => b.createdAt - a.createdAt);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(plans));
  }

  /**
   * Obtiene todos los planes guardados, ordenados por fecha (más recientes primero)
   */
  getAllPlans(): Plan[] {
    const plansJson = localStorage.getItem(this.STORAGE_KEY);
    if (!plansJson) {
      return [];
    }
    
    try {
      const plans = JSON.parse(plansJson) as Plan[];
      // Asegurar que estén ordenados por fecha
      return plans.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error al parsear planes desde localStorage:', error);
      return [];
    }
  }

  /**
   * Obtiene un plan específico por su uid
   */
  getPlanById(uid: string): Plan | null {
    const plans = this.getAllPlans();
    return plans.find(p => p.uid === uid) || null;
  }

  /**
   * Elimina un plan del historial
   */
  deletePlan(uid: string): void {
    const plans = this.getAllPlans();
    const filteredPlans = plans.filter(p => p.uid !== uid);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredPlans));
  }

  /**
   * Limpia todos los planes guardados
   */
  clearAllPlans(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Obtiene el número total de planes guardados
   */
  getTotalPlansCount(): number {
    return this.getAllPlans().length;
  }

  /**
   * Obtiene planes filtrados por tipo
   */
  getPlansByType(planType: Plan['planType']): Plan[] {
    return this.getAllPlans().filter(p => p.planType === planType);
  }
}
