import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { heartOutline, heart, arrowBackOutline, arrowForwardOutline } from 'ionicons/icons';
import { RevenueCatService } from '@chesspark/revenuecat';
import { Package, PurchasesError, PURCHASES_ERROR_CODE } from '@chesspark/revenuecat';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

addIcons({ heartOutline, heart, arrowBackOutline, arrowForwardOutline });

export interface DonationOption {
  id: string;
  amount: number;
  label: string;
  description: string;
  packageIdentifier: string;
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
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    NavbarComponent,
  ],
})
export class DonationPage implements OnInit {
  private revenueCat = inject(RevenueCatService);
  private loadingController = inject(LoadingController);
  private toastController = inject(ToastController);
  private router = inject(Router);

  donationOptions: DonationOption[] = [
    {
      id: 'donation_small',
      amount: 3,
      label: '$3',
      description: 'Donación pequeña - Renovación mensual',
      packageIdentifier: 'donation_small',
    },
    {
      id: 'donation_medium',
      amount: 5,
      label: '$5',
      description: 'Donación mediana - Renovación mensual',
      packageIdentifier: 'donation_medium',
    },
    {
      id: 'donation_large',
      amount: 10,
      label: '$10',
      description: 'Donación grande - Renovación mensual',
      packageIdentifier: 'donation_large',
    },
  ];

  availablePackages: Package[] = [];
  isLoading = false;
  isNativePlatform = false;

  ngOnInit() {
    this.isNativePlatform = Capacitor.isNativePlatform();
    if (this.isNativePlatform) {
      this.loadDonationOptions();
    }
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
              label: packageFromRC.product.priceString,
              amount: packageFromRC.product.price,
            };
          }
          return option;
        });
      }
    } catch (error) {
      console.error('Error al cargar opciones de donación:', error);
      this.showToast('Error al cargar opciones de donación', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Procesa una donación seleccionada
   */
  async processDonation(option: DonationOption) {
    if (!this.isNativePlatform) {
      this.showToast('Las donaciones solo están disponibles en dispositivos móviles', 'warning');
      return;
    }

    // Buscar el package correspondiente
    const packageToPurchase = this.availablePackages.find(
      (pkg) => pkg.identifier === option.packageIdentifier
    );

    if (!packageToPurchase) {
      this.showToast('Opción de donación no disponible', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Procesando donación...',
      spinner: 'crescent',
    });

    try {
      await loading.present();

      const purchaseResult = await this.revenueCat.purchasePackage(packageToPurchase);

      await loading.dismiss();

      // Verificar si la compra fue exitosa
      if (purchaseResult.customerInfo) {
        this.showToast('¡Gracias por tu donación!', 'success');
      }
    } catch (error: unknown) {
      await loading.dismiss();

      if (error instanceof PurchasesError) {
        switch (error.code) {
          case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED:
            // Usuario canceló, no mostrar error
            break;
          case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED:
            this.showToast('Las compras no están permitidas en este dispositivo', 'warning');
            break;
          case PURCHASES_ERROR_CODE.NETWORK_ERROR:
            this.showToast('Error de conexión. Verifica tu internet.', 'danger');
            break;
          case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE:
            this.showToast('Esta opción no está disponible en este momento', 'warning');
            break;
          default:
            const errorMessage = error.message || 'Error desconocido';
            this.showToast(`Error: ${errorMessage}`, 'danger');
        }
      } else {
        this.showToast('Error al procesar la donación', 'danger');
        console.error('Error desconocido:', error);
      }
    }
  }

  /**
   * Restaura compras previas
   */
  async restorePurchases() {
    if (!this.isNativePlatform) {
      this.showToast('Las donaciones solo están disponibles en dispositivos móviles', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Restaurando compras...',
      spinner: 'crescent',
    });

    try {
      await loading.present();
      await this.revenueCat.restorePurchases();
      await loading.dismiss();
      this.showToast('Compras restauradas exitosamente', 'success');
    } catch (error: unknown) {
      await loading.dismiss();
      this.showToast('Error al restaurar compras', 'danger');
      console.error('Error al restaurar:', error);
    }
  }

  /**
   * Navega de vuelta
   */
  goBack() {
    this.router.navigate(['/home']);
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
