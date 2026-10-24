import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  LoadingController,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { heartOutline, heart, arrowBackOutline, arrowForwardOutline, informationCircleOutline, trophyOutline, cafeOutline, starOutline, banOutline, trendingUpOutline, codeSlashOutline, logInOutline } from 'ionicons/icons';
import { RevenueCatService } from '@chesspark/revenuecat';
import { Package, PurchasesError, PURCHASES_ERROR_CODE } from '@chesspark/revenuecat';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { ProfileService } from '@core/account/profile.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { Subscription } from 'rxjs';

addIcons({ heartOutline, heart, arrowBackOutline, arrowForwardOutline, informationCircleOutline, trophyOutline, cafeOutline, starOutline, banOutline, trendingUpOutline, codeSlashOutline, logInOutline });

export interface DonationOption {
  id: string;
  amount: number;
  label: string;
  description: string;
  packageIdentifier: string;
  tierKey: 'pawn' | 'rook' | 'queen';
}

@Component({
  selector: 'app-donation',
  templateUrl: './donation.page.html',
  styleUrls: ['./donation.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    NavbarComponent,
  ],
})
export class DonationPage implements OnInit, OnDestroy {
  private revenueCat = inject(RevenueCatService);
  private loadingController = inject(LoadingController);
  private toastController = inject(ToastController);
  private transloco = inject(TranslocoService);
  private modalController = inject(ModalController);
  private profileService = inject(ProfileService);
  private router = inject(Router);
  private analyticsService = inject(AnalyticsService);

  isAuthenticated = false;
  private profileSub?: Subscription;

  donationOptions: DonationOption[] = [
    {
      id: 'donation_small',
      amount: 2,
      label: '$2',
      description: '',
      packageIdentifier: 'donation_small',
      tierKey: 'pawn',
    },
    {
      id: 'donation_medium',
      amount: 5,
      label: '$5',
      description: '',
      packageIdentifier: 'donation_medium',
      tierKey: 'rook',
    },
    {
      id: 'donation_large',
      amount: 8,
      label: '$8',
      description: '',
      packageIdentifier: 'donation_large',
      tierKey: 'queen',
    },
  ];

  availablePackages: Package[] = [];
  isLoading = false;
  isNativePlatform = false;

  ngOnInit() {
    this.isNativePlatform = Capacitor.isNativePlatform();
    this.profileSub = this.profileService.profile$.subscribe((profile) => {
      this.isAuthenticated = !!profile;
      // Las compras son de la tienda del móvil: en la web no hay ofertas que pedir
      if (this.isAuthenticated && this.isNativePlatform) {
        this.loadDonationOptions();
      }
    });
  }

  ngOnDestroy() {
    this.profileSub?.unsubscribe();
  }

  async openLogin() {
    const modal = await this.modalController.create({
      component: LoginComponent,
      componentProps: { segmentEmailPassword: 'login' },
    });
    await modal.present();
  }

  /**
   * Carga las opciones de donación desde RevenueCat
   */
  async loadDonationOptions() {
    try {
      this.isLoading = true;
      const offerings = await this.revenueCat.getOfferings();

      if (offerings.current) {
        // Filtrar packages de donación
        this.availablePackages = offerings.current.availablePackages.filter(
          (pkg) => pkg.identifier.startsWith('donation_')
        );

        // Actualizar los precios desde RevenueCat
        this.donationOptions = this.donationOptions.map((option) => {
          const packageFromRC = this.availablePackages.find(
            (pkg) => pkg.identifier === option.packageIdentifier
          );
          if (packageFromRC) {
            return {
              ...option,
              label: `${packageFromRC.product.priceString} ${packageFromRC.product.currencyCode}`,
              amount: packageFromRC.product.price,
            };
          }
          return option;
        });
      }
    } catch (error) {
      console.error('Error al cargar opciones de donación:', error);
      this.showToast(this.t('loadFailed'), 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Procesa una donación seleccionada
   */
  async processDonation(option: DonationOption) {
    if (!this.isNativePlatform) {
      this.showToast(this.t('mobileOnly'), 'warning');
      return;
    }

    // Buscar el package correspondiente
    const packageToPurchase = this.availablePackages.find(
      (pkg) => pkg.identifier === option.packageIdentifier
    );

    if (!packageToPurchase) {
      this.showToast(this.t('optionUnavailable'), 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: this.t('processing'),
      spinner: 'crescent',
    });

    try {
      await loading.present();

      const purchaseResult = await this.revenueCat.purchasePackage(packageToPurchase);

      await loading.dismiss();

      // Verificar si la compra fue exitosa
      if (purchaseResult.customerInfo) {
        this.showToast(this.t('thanks'), 'success');
        void this.analyticsService.logEvent('donation_completed', {
          value: option.amount,
          currency: packageToPurchase.product?.currencyCode ?? '',
          item_id: packageToPurchase.identifier,
        });
      }
    } catch (error: unknown) {
      await loading.dismiss();

      if (error instanceof PurchasesError) {
        switch (error.code) {
          case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED:
            // Usuario canceló, no mostrar error
            break;
          case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED:
            this.showToast(this.t('purchasesNotAllowed'), 'warning');
            break;
          case PURCHASES_ERROR_CODE.NETWORK_ERROR:
            this.showToast(this.t('networkError'), 'danger');
            break;
          case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE:
            this.showToast(this.t('notAvailableNow'), 'warning');
            break;
          default: {
            const errorMessage = error.message || this.t('unknownError');
            this.showToast(this.t('errorWith', { message: errorMessage }), 'danger');
          }
        }
      } else {
        this.showToast(this.t('processFailed'), 'danger');
        console.error('Error desconocido:', error);
      }
    }
  }

  /**
   * Restaura compras previas
   */
  async restorePurchases() {
    if (!this.isNativePlatform) {
      this.showToast(this.t('mobileOnly'), 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: this.t('restoring'),
      spinner: 'crescent',
    });

    try {
      await loading.present();
      await this.revenueCat.restorePurchases();
      await loading.dismiss();
      this.showToast(this.t('restored'), 'success');
    } catch (error: unknown) {
      await loading.dismiss();
      this.showToast(this.t('restoreFailed'), 'danger');
      console.error('Error al restaurar:', error);
    }
  }

  /**
   * Navega de vuelta
   */
  goBack() {
    this.router.navigate(['/home']);
  }

  /** Texto traducido de los avisos de donación. */
  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(`DONATION.messages.${key}`, params);
  }

  /**
   * Muestra un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
