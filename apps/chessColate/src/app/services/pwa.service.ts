import { Injectable, signal } from '@angular/core';

const IOS_BANNER_DISMISSED_KEY = 'pwa_ios_banner_dismissed';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly showIosBanner = signal(false);

  readonly isMobileBrowser = this.checkIsMobileBrowser();
  readonly isIos = this.checkIsIos();

  constructor() {
    if (!this.isMobileBrowser) return;

    if (this.isIos) {
      const dismissed = localStorage.getItem(IOS_BANNER_DISMISSED_KEY);
      if (!dismissed) {
        this.showIosBanner.set(true);
      }
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
    });
  }

  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.deferredPrompt = null;
      this.canInstall.set(false);
    }
  }

  dismissIosBanner(): void {
    localStorage.setItem(IOS_BANNER_DISMISSED_KEY, '1');
    this.showIosBanner.set(false);
  }

  private checkIsMobileBrowser(): boolean {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    return isMobile && !isStandalone;
  }

  private checkIsIos(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
