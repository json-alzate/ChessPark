import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { SoundsService } from '@chesspark/common-utils';
import { SilentSoundsService } from '@core/sounds/silent-sounds.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: SoundsService, useClass: SilentSoundsService },
  ],
};
