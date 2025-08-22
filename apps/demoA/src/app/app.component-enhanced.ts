import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root-enhanced',
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  imports: [IonApp, IonRouterOutlet],
  standalone: true
})
export class AppComponentEnhanced implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    console.log('🔄 AppComponentEnhanced inicializando...');
    
    // Verificar si estamos en Angular Elements
    if (customElements.get('demo-a-app')) {
      console.log('✅ Detectado Angular Elements, configurando router...');
      
      // Configurar el base href para Angular Elements
      if (!document.querySelector('base[href]')) {
        const base = document.createElement('base');
        base.href = '/';
        document.head.appendChild(base);
        console.log('✅ Base href configurado');
      }
      
      // Inicializar el router después de un pequeño delay
      setTimeout(() => {
        this.initializeRouter();
      }, 100);
    } else {
      console.log('ℹ️ Aplicación Angular normal, router se inicializa automáticamente');
    }
  }

  private async initializeRouter() {
    try {
      console.log('🔄 Inicializando router en Angular Elements...');
      
      // Navegar a la ruta inicial
      await this.router.navigate(['/']);
      console.log('✅ Router inicializado correctamente');
      
      // Verificar el estado del router
      console.log('📍 Ruta actual:', this.router.url);
      console.log('📋 Configuración del router:', this.router.config);
      
    } catch (error) {
      console.error('❌ Error al inicializar router:', error);
    }
  }
} 