
import { Component,  CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';


import {   IonContent } from '@ionic/angular/standalone';



import { BoardComponent } from '@chesspark/board';


@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, IonContent, BoardComponent ],
})
export class LoginPage {


}
