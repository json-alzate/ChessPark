import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PlansElosService {
  constructor() {}

  getWeakness(planElos: { [key: string]: number }): string | null {
    if (!planElos || Object.keys(planElos).length === 0) {
      return null;
    }
    
    const entries = Object.entries(planElos);
    const weakest = entries.reduce((min, current) => 
      current[1] < min[1] ? current : min
    );
    
    return weakest[0];
  }

  getStrongestTheme(planElos: { [key: string]: number }): string | null {
    if (!planElos || Object.keys(planElos).length === 0) {
      return null;
    }
    
    const entries = Object.entries(planElos);
    const strongest = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    
    return strongest[0];
  }
}

