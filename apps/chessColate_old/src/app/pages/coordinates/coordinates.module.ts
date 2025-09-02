import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from '@shared/shared.module';


import { CoordinatesPageRoutingModule } from './coordinates-routing.module';

import * as fromComponents from './components/';
import { CoordinatesPage } from './coordinates.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        CoordinatesPageRoutingModule,
        SharedModule
    ],
    declarations: [
        CoordinatesPage,
        ...fromComponents.COMPONENTS
    ]
})
export class CoordinatesPageModule { }
