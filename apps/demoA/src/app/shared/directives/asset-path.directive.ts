import { Directive, ElementRef, Input, OnInit } from '@angular/core';

@Directive({
  selector: '[appAssetPath]',
  standalone: true
})
export class AssetPathDirective implements OnInit {
  @Input() appAssetPath = '';

  constructor(private el: ElementRef) {}

  ngOnInit() {
    if (this.appAssetPath) {
      this.updateAssetPath();
    }
  }

  private updateAssetPath() {
    const element = this.el.nativeElement;
    
    // Detectar el contexto de ejecución
    const context = this.detectContext();
    let newPath = '';
    
    switch (context) {
      case 'webview':
        // En WebView, usar ruta relativa al directorio actual
        newPath = `./assets/${this.appAssetPath}`;
        break;
      case 'angular-elements':
        // En Angular Elements, usar ruta relativa
        newPath = `./assets/${this.appAssetPath}`;
        break;
      case 'capacitor':
        // En Capacitor, usar ruta absoluta
        newPath = `/assets/${this.appAssetPath}`;
        break;
      default:
        // En Angular normal, usar ruta estándar
        newPath = `assets/${this.appAssetPath}`;
        break;
    }
    
    // Aplicar la ruta al elemento
    if (element.tagName === 'IMG') {
      element.src = newPath;
    } else if (element.tagName === 'ION-IMG') {
      element.src = newPath;
    } else {
      element.setAttribute('src', newPath);
    }
    
    console.log(`🔄 Asset path actualizado [${context}]: ${newPath}`);
  }

  private detectContext(): 'webview' | 'angular-elements' | 'capacitor' | 'angular' {
    if (typeof window === 'undefined') {
      return 'angular';
    }
    
    // Detectar WebView
    if ((window as any).webkit?.messageHandlers || (window as any).Android) {
      return 'webview';
    }
    
    // Detectar Angular Elements
    if (customElements.get('demo-a-app') || 
        customElements.get('demo-a-app-enhanced') || 
        customElements.get('demo-a-app-simple')) {
      return 'angular-elements';
    }
    
    // Detectar Capacitor
    if ((window as any).Capacitor || (window as any).capacitor) {
      return 'capacitor';
    }
    
    return 'angular';
  }
} 