import { APP_INITIALIZER, ErrorHandler, NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Router, RouteReuseStrategy } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';


import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';


import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { environment } from '../environments/environment';

import { SharedModule } from '@shared/shared.module';


/* @ngrx */
import { StoreModule } from '@ngrx/store';
import { appReducers, clearStateMetaReducer } from '@redux/reducers/app.reducers';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { CustomRouterStateSerializer } from '@redux/states/router.state';

import * as fromEffects from '@redux/effects';
import * as fromGuards from '@guards/index';





// AoT requires an exported function for factories
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions, @typescript-eslint/naming-convention
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

import { ServiceWorkerModule } from '@angular/service-worker';




const PROVIDERS = [
  ...fromGuards.guards
];

let devImports = [
  StoreDevtoolsModule.instrument({
    maxAge: 25,
    logOnly: environment.production
  })
];

if (environment.production) {
  devImports = [];
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(),
    AppRoutingModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      },
      defaultLanguage: 'en'
    }),
    /* NGRX */
    StoreRouterConnectingModule.forRoot({
      serializer: CustomRouterStateSerializer
    }),
    StoreModule.forRoot(appReducers, { metaReducers: [clearStateMetaReducer] }),
    ...devImports,
    EffectsModule.forRoot(fromEffects.EFFECTS),
    // SocketIoModule.forRoot(config),
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    PROVIDERS,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
