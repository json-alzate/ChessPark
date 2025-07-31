import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';


import { PlanElos } from '@models/planElos.model';



// State
import { PlansElosState } from '@redux/states/plans-elos.state';

// Store
import { Store } from '@ngrx/store';

// Actions
import {
  requestAddOnePlanElo,
  addOnePlanElo,
  requestLoadPlansElos,
  requestUpdatePlanElos,
  updatePlanElos
} from '@redux/actions/plans-elos.actions';

// Selectors
import { getPlanElo } from '@redux/selectors/plans-elos.selectors';


// services
import { FirestoreService } from '@services/firestore.service';
import { AppService } from '@services/app.service';

// utils
import { calculateElo } from '@utils/calculate-elo';
import { createUid } from '@utils/create-uid';


@Injectable({
  providedIn: 'root'
})
export class PlansElosService {

  constructor(
    private store: Store<PlansElosState>,
    private firestoreService: FirestoreService,
    private appService: AppService
  ) { }

  requestGetPlansElosAction(uidUser: string) {
    const action = requestLoadPlansElos({ uidUser });
    this.store.dispatch(action);
  }

  requestGetPlansElos(uidUser: string) {
    return this.firestoreService.getPlansElos(uidUser);
  }

  savePlanElo(planElo: PlanElos) {
    return this.firestoreService.savePlanElo(planElo);
  }

  updatePlanElo(planElo: PlanElos) {
    return this.firestoreService.updatePlanElo(planElo);
  }

  async getOnePlanElo(planUid: string) {
    return await firstValueFrom(this.store.select(getPlanElo(planUid)));
  }

  async calculatePlanElos(
    puzzleElo: number,
    result: 1 | 0.5 | 0,
    planUid: string,
    uidUser: string,
    themes: string[],
    openingFamily: string,
  ) {
    // Intentar obtener el PlanElos desde el estado.
    let planElos: PlanElos = await firstValueFrom(this.store.select(getPlanElo(planUid)));
    console.log('planElos', planElos);

    // Si `planElos` es null o undefined, inicializarlo con los valores predeterminados.
    if (!planElos) {
      planElos = {
        uid: '',        // Inicializa con valores vacíos o predeterminados
        uidUser,
        uidPlan: planUid,
        openings: {},
        themes: {},
        total: 1500     // Valor inicial si no existe un valor total
      };
    } else {
      // Crear una copia inmutable del objeto planElos
      planElos = {
        ...planElos,
        openings: { ...planElos.openings },
        themes: { ...planElos.themes }
      };
    }

    let eloOpening = 1500;

    // Si existe `openingFamily` y las aperturas en `planElos`
    if (openingFamily && planElos.openings) {
      eloOpening = calculateElo(planElos.openings[openingFamily] || 1500, puzzleElo, result);
    } else {
      eloOpening = calculateElo(1500, puzzleElo, result);
    }

    // Clonar o crear `themes` si no existen
    const temThemes = planElos.themes ? { ...planElos.themes } : {};

    // Actualizar los temas con los nuevos cálculos de Elo
    themes.forEach(theme => {
      temThemes[theme] = calculateElo((temThemes[theme] || 1500), puzzleElo, result);
    });
    planElos.themes = temThemes;

    // Calcular el Elo total del plan
    const currentTotalElo = planElos.total || 1500;
    const newTotalElo = calculateElo(currentTotalElo, puzzleElo, result);
    planElos.total = newTotalElo;

    // Actualizar aperturas en el estado si es necesario
    if (openingFamily) {
      planElos.openings = {
        ...(planElos.openings || {}),
        [openingFamily]: eloOpening
      };
    }

    // Determinar si se debe actualizar o agregar el plan en el estado
    if (planElos.uid) {
      this.store.dispatch(requestUpdatePlanElos({ planElo: planElos }));
    } else {
      planElos.uid = createUid();
      planElos.uidUser = uidUser;
      planElos.uidPlan = planUid;
      this.store.dispatch(requestAddOnePlanElo({ planElo: planElos }));
    }
  }


  /**
   * @param themes : or Openings { [key: string]: number; }
   * @returns Return the name of the theme with the lowest value
   */
  public getWeakness(themes: { [key: string]: number }): string {
    let lowestValue = Infinity; // Inicializar con Infinity para asegurarse de que cualquier valor sea menor.
    let weakestTheme = ''; // Para almacenar el nombre del tema más débil.

    Object.keys(themes).forEach(key => {
      if (themes[key] < lowestValue && this.appService.validateThemesInList(key)) {
        lowestValue = themes[key];
        weakestTheme = key; // Almacenar el nombre del tema.
      }
    });
    return weakestTheme; // Devolver el nombre del tema más débil.
  }
}
