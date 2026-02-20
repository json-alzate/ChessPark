import { Plan } from './plan.model';

// PublicPlan es una duplicación completa de Plan con estadísticas agregadas
export interface PublicPlan extends Plan {
  // Todos los campos de Plan están incluidos
  // Campos adicionales para estadísticas:
  timesPlayed: number;
  likesCount: number;
  savedCount: number;
  lastPlayedAt?: number;
  userInteraction?: PlanInteraction; // Interacción del usuario actual (se agrega en el servicio)
}

export interface PlanInteraction {
  uid: string;
  uidUser: string;
  planUid: string;
  liked: boolean;
  played: boolean;
  saved: boolean;
  likedAt?: number;
  playedAt?: number;
  savedAt?: number;
}

export type PublicPlanFilter = 'recent' | 'mostPlayed' | 'mostLiked';
