
import { Component,  CUSTOM_ELEMENTS_SCHEMA, inject, OnInit, signal  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {   IonContent } from '@ionic/angular/standalone';

import { ThemeSelectorComponent } from '../../shared/components/theme-selector/theme-selector.component';
import { ThemeApplyDirective } from '../../shared/directives/theme-apply.directive';
import { AssetPathDirective } from '../../shared/directives/asset-path.directive';



@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ CommonModule, ReactiveFormsModule, ThemeSelectorComponent, IonContent, ThemeApplyDirective, AssetPathDirective ],
})
export class LoginPage {

  private fb = inject(FormBuilder);
  private router = inject(Router);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  errorMessage = signal('');

  // Usuario de prueba
  private demoUser = {
    username: 'xerpa',
    password: '123456'
  };

  constructor() {
    this.loginForm.valueChanges.subscribe(() => {
      this.errorMessage.set('');
    });
  }

  onSubmit() {
    const { username, password } = this.loginForm.value;

    if (
      username === this.demoUser.username &&
      password === this.demoUser.password
    ) {
      this.router.navigateByUrl('/home');
    } else {
      this.errorMessage.set('Usuario o contraseña incorrectos.');
    }
  }

}
