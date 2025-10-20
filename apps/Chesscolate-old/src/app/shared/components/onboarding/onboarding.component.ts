//core and third party libraries
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';

// rxjs

// states
import { AuthState } from '@redux/states/auth.state';


// actions
import { requestUpdateProfile, addNewNickName } from '@redux/actions/auth.actions';

// selectors
import { getProfile } from '@redux/selectors/auth.selectors';

// models
import { Profile } from '@models/profile.model';

// services
import { ProfileService } from '@services/profile.service';
import { AuthService } from '@services/auth.service';

// components

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss'],
})
export class OnboardingComponent implements OnInit {

  nickname = '';
  allowNickName = false;
  errorToShow = 'Requerido';
  loading = false;

  profile: Profile;

  fieldNickName = new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]);

  constructor(
    private profileService: ProfileService,
    private modalController: ModalController,
    private authService: AuthService,
    private store: Store<AuthState>
  ) {

    // TODO: Cancelar subscribe
    this.store.select(getProfile).subscribe(profile => this.profile = profile);
  }


  ngOnInit() {

    this.fieldNickName.valueChanges.subscribe((value) => {
      this.nickname = value;
      this.checkNickname(value);
    });
  }

  convertToLowercase(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const lowercaseValue = value.toLowerCase();
    this.fieldNickName.setValue(lowercaseValue, { emitEvent: false });
  }



  checkNickname(nickName: string) {
    nickName = nickName.trim().toLowerCase();
    this.loading = true;
    if (!nickName) {
      this.errorToShow = 'Requerido';
      this.loading = false;
      return;
    }
    if (nickName.length < 3) {
      this.errorToShow = 'Mínimo 3 caracteres';
      this.loading = false;
      return;
    }
    if (nickName.length > 20) {
      this.errorToShow = 'Máximo 20 caracteres';
      this.loading = false;
      return;
    }

    const isValid: boolean = /^[_a-zA-Z0-9]+$/.test(nickName);
    if (!isValid) {
      this.errorToShow = 'Solo letras, números y guión bajo';
      this.loading = false;
      return;
    }

    this.profileService.checkNickNameExist(nickName).then((result) => {
      if (result?.length === 0) {
        this.allowNickName = true;
        this.errorToShow = '';
      } else {
        this.allowNickName = false;
        this.errorToShow = 'Ya existe';
      }
      this.loading = false;
    }).catch(() => {
      this.allowNickName = false;
      this.errorToShow = 'Error';
      this.loading = false;
    });
  }




  save() {
    if (!this.allowNickName) {
      return;
    }

    const action = requestUpdateProfile({
      profile: {
        name: this.nickname
      }
    });
    this.store.dispatch(action);

    const actionAddNick = addNewNickName({
      nickname: this.nickname,
      uidUser: this.profile?.uid
    });
    this.store.dispatch(actionAddNick);


    this.modalController.dismiss();
  }

  logout() {
    this.authService.triggerLogout();
    this.modalController.dismiss();
  }

}
