import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from '@shared/shared.module';

import { PuzzlesPageRoutingModule } from './puzzles-routing.module';

import * as fromContainers from './containers';
import * as fromComponents from './components/';
import { PuzzlesPage } from './puzzles.page';

@NgModule({
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        IonicModule,
        PuzzlesPageRoutingModule,
        SharedModule
    ],
    declarations: [
        PuzzlesPage,
        ...fromComponents.COMPONENTS,
        ...fromContainers.CONTAINERS
    ]
})
export class PuzzlesPageModule { }
