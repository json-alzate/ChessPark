import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'selected-theme';
const TARGET_SELECTOR = '#theme-target'; // 👈 id o clase de tu contenedor

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private themeSignal = signal<string>('light');



    constructor() {
        const stored = localStorage.getItem('selected-theme') || 'light';
        this.themeSignal.set(stored);

        // Aplica el tema en el primer render
        requestAnimationFrame(() => {
            const el = document.querySelector(TARGET_SELECTOR);
            if (el) {
                el.setAttribute('data-theme', stored);
            }
        });
    }

    setTheme(theme: string) {
        this.themeSignal.set(theme);
        localStorage.setItem(THEME_KEY, theme);

        document.querySelectorAll('#theme-target').forEach(el => {
            el.setAttribute('data-theme', theme);
          });
    }

    theme = () => this.themeSignal.asReadonly();
}