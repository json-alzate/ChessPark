import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// Ionic
import { IonContent } from '@ionic/angular/standalone';

// Components
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { TrainingMenuComponent } from './components/training-menu.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonContent,
    CommonModule,
    NavbarComponent,
    TrainingMenuComponent],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  generalEloPlan5 = 1200;
  generalEloPlan10 = 1200;
  generalEloPlan15 = 1200;
  generalEloPlan20 = 1200;
  generalEloPlan25 = 1200;
  generalEloPlan30 = 1200;

  planBlood = 'warmup'; // 'warmup' | 'backToCalm' | null

  createPlan(type: string) {
    console.log('Creating plan:', type);
    // Aquí iría la lógica para crear el plan según el tipo seleccionado
  }

  goToCustomPlanCreate() {
    console.log('Navigating to custom plan creation');
    // Aquí iría la lógica para navegar a la página de creación de planes personalizados
  }
}
