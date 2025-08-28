import {
  Component,
  computed,
  inject,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../services/theme.service';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  refreshOutline,
  infiniteOutline,
  stopOutline,
} from 'ionicons/icons';
import { IonIcon, IonSelect, IonSelectOption } from '@ionic/angular/standalone';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [IonIcon, CommonModule, IonSelect, IonSelectOption],
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
})
export class ThemeSelectorComponent {
  private themeService = inject(ThemeService);
  themes = [
    'light',
    'dark',
    'cupcake',
    'bumblebee',
    'emerald',
    'corporate',
    'synthwave',
    'retro',
    'cyberpunk',
    'valentine',
    'halloween',
    'garden',
    'forest',
    'aqua',
    'lofi',
    'pastel',
    'fantasy',
    'wireframe',
    'black',
    'luxury',
    'dracula',
    'cmyk',
    'autumn',
    'business',
    'acid',
    'lemonade',
    'night',
    'coffee',
    'winter',
    'dim',
    'nord',
    'sunset',
    'caramelatte',
    'abyss',
    'silk',
  ];

  selectedTheme = this.themeService.theme();
  isMobile = window.innerWidth <= 768;

  @Input() showBackButton = false;
  @Input() showSimulateLoading = false;
  @Input() showStopSimulateLoading = false;
  @Output() back = new EventEmitter<void>();
  @Output() simulateLoading = new EventEmitter<void>();
  @Output() stopSimulateLoading = new EventEmitter<void>();

  constructor() {
    addIcons({
      arrowBackOutline,
      infiniteOutline,
      stopOutline,
      refreshOutline,
    });
  }

  onNativeSelectChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.themeService.setTheme(value);
  }

  onIonSelectChange(event: CustomEvent) {
    const value = event.detail.value;
    this.themeService.setTheme(value);
  }

  onBackClick() {
    this.back.emit();
  }

  onSimulateLoadingClick() {
    this.simulateLoading.emit();
  }

  onStopSimulateLoadingClick() {
    this.stopSimulateLoading.emit();
  }

  currentTheme = computed(() => this.selectedTheme());
}
