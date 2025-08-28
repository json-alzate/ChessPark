import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { IonContent, IonSelect, IonIcon, IonSelectOption } from '@ionic/angular/standalone';
import { ThemeSelectorComponent } from '../../shared/components/theme-selector/theme-selector.component';
import { inject } from '@angular/core';
import { signal } from '@angular/core';
import { addYears, addMonths, formatDistanceToNow, formatISO, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';


import { addIcons } from 'ionicons';
import { arrowDownOutline,flagOutline, cashOutline ,calendarOutline} from 'ionicons/icons';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { ThemeApplyDirective } from '../../shared/directives/theme-apply.directive';
import { GoalsFacadeService } from '@xerpa/state';
import { XerpaGoal } from '@xerpa/models';
import { DataService } from '../../services/data.service';
import { AssetService } from '../../services/asset.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'app-create-goal',
  templateUrl: 'create-goal.page.html',
  styleUrls: ['create-goal.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, ReactiveFormsModule, ThemeSelectorComponent, IonContent, IonSelect, IonIcon, IonSelectOption, ThemeApplyDirective],
})
export class CreateGoalPage implements AfterViewInit {
  @ViewChild('swiperContainer') swiperContainer: any;
  private fb = inject(FormBuilder);
  private goalsFacade = inject(GoalsFacadeService);
  private dataService = inject(DataService);
  private assetService = inject(AssetService);
  private location = inject(Location);
  currentStep = signal(0);
  isMobile = window.innerWidth <= 768;

  goalDetailsForm = this.fb.group({
    name: ['', Validators.required],
    amount: ['', [Validators.required, Validators.min(1)]],
    endDate: [formatISO(addYears(new Date(), 1), { representation: 'date' }), Validators.required],
  });

  accountsForm = this.fb.group({
    originAccount: [null, Validators.required],
    destinationAccount: [null, Validators.required],
  });

  goalTypes = this.assetService.getGoalImages();

  cuentas = [
    { id: 1, nombre: 'Cuenta Nómina BBVA' },
    { id: 2, nombre: 'Cuenta Ahorro Santander' },
    { id: 3, nombre: 'Cuenta Corriente Banamex' },
  ];

  selectedGoalType: { title: string; img: string } | null = null;
  goalPlaceholders: Record<string, string> = {
    'Casa': 'Ej: Comprar mi casa propia',
    'Compras': 'Ej: Nuevo smartphone',
    'Deudas': 'Ej: Pagar tarjeta de crédito',
    'Educación': 'Ej: Maestría en el extranjero',
    'Evento': 'Ej: Boda de mi hermana',
    'Otros': 'Ej: Fondo de emergencia',
    'Salud': 'Ej: Cirugía dental',
    'Vehículo': 'Ej: Comprar un auto',
    'Viaje': 'Ej: Viaje a Europa',
  };

  constructor(
    private router: Router, 
    private navCtrl: NavController,
    private navigationService: NavigationService
  ) {
    addIcons({ arrowDownOutline, flagOutline, cashOutline, calendarOutline });
  }

  get nameField() {
    return this.goalDetailsForm.get('name');
  }

  get amountField() {
    return this.goalDetailsForm.get('amount');
  }

  get endDateField() {
    return this.goalDetailsForm.get('endDate');
  }

  get originAccountField() {
    return this.accountsForm.get('originAccount');
  }
  get destinationAccountField() {
    return this.accountsForm.get('destinationAccount');
  }

  onOriginAccountChange(value: any) {
    this.accountsForm.get('originAccount')?.setValue(value);
  }
  onDestinationAccountChange(value: any) {
    this.accountsForm.get('destinationAccount')?.setValue(value);
  }
  openRulesModal() {
    // Aquí se lanzaría el modal para elegir/configurar reglas
    // alert('Aquí se abriría el modal para configurar reglas de ahorro');
  }

  onDetailsSubmit() {
    if (this.goalDetailsForm.valid) {
      this.navigateToStep(2);
    }
  }

  onAccountsSubmit() {
    if (this.accountsForm.valid) {
      this.navigateToStep(3);
    }
  }

  onSubmit() {
    if (this.goalDetailsForm.valid && this.accountsForm.valid) {
      const name = this.goalDetailsForm.get('name')?.value || '';
      const amount = Number(this.goalDetailsForm.get('amount')?.value) || 0;
      const endDateRaw = this.goalDetailsForm.get('endDate')?.value;
      const endDate = endDateRaw ? new Date(endDateRaw).getTime() : Date.now();
      const originAccount = this.accountsForm.get('originAccount')?.value || '';
      const destinationAccount = this.accountsForm.get('destinationAccount')?.value || '';
      const type = (this.selectedGoalType?.title?.toLowerCase() as XerpaGoal['type']) || 'otros';
      const newGoal: XerpaGoal = {
        id: Date.now().toString(),
        project_name: name,
        description: '',
        type,
        total: amount,
        amountSaved: 0,
        end_date: endDate,
        from_account: originAccount,
        to_account: destinationAccount,
        created_at: Date.now()
      };
      this.goalsFacade.addGoal(newGoal);
      this.dataService.saveGoal(newGoal);
      this.goalDetailsForm.reset();
      this.accountsForm.reset();
      this.selectedGoalType = null;
      this.currentStep.set(0);
      this.router.navigate(['/home'], { queryParams: { refresh: '1' }, replaceUrl: true });
    }
  }

  selectGoalType(tipo: { title: string; img: string }) {
    this.selectedGoalType = tipo;
    // Cambia el placeholder del nombre si ya hay un control
    if (this.goalDetailsForm.get('name')) {
      this.goalDetailsForm.get('name')?.setValue('');
    }
    this.navigateToStep(1);
  }

  getGoalNamePlaceholder(): string {
    if (this.selectedGoalType && this.goalPlaceholders[this.selectedGoalType.title]) {
      return this.goalPlaceholders[this.selectedGoalType.title];
    }
    return 'Ej: Viaje a Europa';
  }

  getEndDateLabel(): string {
    const value = this.goalDetailsForm.get('endDate')?.value;
    if (!value) return '';
    try {
      return 'En ' + formatDistanceToNow(new Date(value), { addSuffix: false, locale: es });
    } catch {
      return '';
    }
  }

  getAccountNameById(id: any): string {
    const cuenta = this.cuentas?.find(c => c.id == id);
    return cuenta ? cuenta.nombre : '';
  }

  ngAfterViewInit() {
    // Configurar el listener para cambios de slide
    if (this.swiperContainer?.nativeElement) {
      this.swiperContainer.nativeElement.addEventListener('slidechange', (event: any) => {
        this.currentStep.set(event.detail[0].activeIndex);
      });
    }
  }

  // NUEVO: Determina si un paso está habilitado
  isStepEnabled(stepIndex: number): boolean {
    if (stepIndex === 0) return true;
    if (stepIndex === 1) return !!this.selectedGoalType;
    if (stepIndex === 2) return !!this.selectedGoalType && this.goalDetailsForm.valid;
    if (stepIndex === 3) return !!this.selectedGoalType && this.goalDetailsForm.valid && this.accountsForm.valid;
    return false;
  }

  // NUEVO: Determina la clase de color del paso
  getStepClass(stepIndex: number): string {
    if (this.currentStep() === stepIndex) return 'step step-info';
    if (this.isStepEnabled(stepIndex)) {
      if (stepIndex < this.currentStep()) return 'step step-success';
      return 'step step-enabled';
    }
    return 'step step-disabled';
  }

  // MODIFICADO: Navegación segura entre pasos
  navigateToStep(stepIndex: number) {
    // Solo permite avanzar si el paso está habilitado
    if (stepIndex <= this.currentStep() || this.isStepEnabled(stepIndex)) {
      if (this.swiperContainer?.nativeElement) {
        this.swiperContainer.nativeElement.swiper.slideTo(stepIndex);
        this.currentStep.set(stepIndex);
      }
    }
  }

  isStepActive(stepIndex: number): boolean {
    return this.currentStep() === stepIndex;
  }

  goBack() {
    this.goalDetailsForm.reset();
    this.accountsForm.reset();
    this.selectedGoalType = null;
    this.navigationService.goBack('/home');
  }
} 