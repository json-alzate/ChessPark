import { Injectable } from '@angular/core';
import { XerpaGoal } from '@xerpa/models';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private readonly STORAGE_KEY = 'xerpa_goals';

  saveGoal(goal: XerpaGoal) {
    const current = this.getGoals();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...current, goal]));
  }

  getGoals(): XerpaGoal[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
}
