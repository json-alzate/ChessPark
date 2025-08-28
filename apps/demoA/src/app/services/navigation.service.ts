import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {

  constructor(
    private router: Router,
    private navCtrl: NavController
  ) {}

  /**
   * Navega hacia atrás con animación apropiada según el contexto
   */
  goBack(route: string) {
    const isWebView = this.isInWebView();
    
    if (isWebView) {
      // En WebView, usar navegación de Angular
      console.log('🌐 Navegando en WebView con Angular...');
      this.router.navigate(['/home'], { replaceUrl: true });
    } else {
      // En aplicación nativa, usar navCtrl para el efecto de deslizar
      console.log('📱 Navegando en aplicación nativa...');
      this.nativeBackNavigation(route);
    }
  }

  /**
   * Navegación nativa usando NavController
   */
  private nativeBackNavigation(route: string) {
    console.log('📱 Usando navegación nativa...');
    try {
      console.log('🔄 Navegando hacia atrás...');
      this.navCtrl.back();
    } catch (error) {
      console.log('NavCtrl falló, usando router...');
      this.router.navigate([route], { replaceUrl: true });
    }
  }

  /**
   * Detecta si estamos en un WebView
   */
  private isInWebView(): boolean {
    return (
      typeof window !== 'undefined' && 
      (
        (window as any).webkit?.messageHandlers || 
        (window as any).Android || 
        customElements.get('demo-a-app') ||
        customElements.get('demo-a-app-enhanced') ||
        customElements.get('demo-a-app-simple')
      )
    );
  }


} 