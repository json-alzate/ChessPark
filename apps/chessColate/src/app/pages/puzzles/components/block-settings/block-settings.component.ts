import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, ValidationErrors } from '@angular/forms';

import { TranslateService } from '@ngx-translate/core';


import { ModalController } from '@ionic/angular';

import { AppPuzzlesThemes, AppPuzzleThemesGroup } from '@models/app.models';
import { Block } from '@models/plan.model';

// services
import { AppService } from '@services/app.service';
import { UiService } from '@services/ui.service';

@Component({
  selector: 'app-block-settings',
  templateUrl: './block-settings.component.html',
  styleUrls: ['./block-settings.component.scss'],
})
export class BlockSettingsComponent implements OnInit {


  @Output() newBlock = new EventEmitter<Block>();
  color = 'random';

  puzzlesGroupsThemes: AppPuzzleThemesGroup[] = [];
  form: FormGroup;

  lang = this.translateService.currentLang;



  constructor(
    private formBuilder: FormBuilder,
    private appService: AppService,
    public uiService: UiService,
    private modalController: ModalController,
    private translateService: TranslateService
  ) {
    this.puzzlesGroupsThemes = this.appService.getThemesPuzzle;

  }

  get timeField() {
    return this.form.get('time');
  }

  get puzzlesCountField() {
    return this.form.get('puzzlesCount');
  }

  get themeField() {
    return this.form.get('theme');
  }

  get eloLevelField() {
    return this.form.get('eloLevel');
  }

  get puzzleTimeField() {
    return this.form.get('puzzleTime');
  }

  get goshPuzzleTimeField() {
    return this.form.get('goshPuzzleTime');
  }




  ngOnInit() {
    this.buildForm();
    this.updateFormValidators();
  }

  buildForm() {
    this.form = this.formBuilder.group({
      time: [300, Validators.required],
      puzzlesCount: [],
      eloLevel: [0],
      theme: 'all',
      openingFamily: '',
      puzzleTime: [60, Validators.required],
      nextPuzzleImmediately: true,
      showPuzzleSolution: true,
      goshPuzzle: false,
      goshPuzzleTime: [{ value: 30, disabled: true }]
    });

    this.form.get('goshPuzzle').valueChanges.subscribe(() => {
      this.toggleFieldBasedOnBoolean('goshPuzzle', 'goshPuzzleTime');
    });
  }

  formatPin(value: number) {
    return value > 0 ? `+${value}` : `${value}`;
  }



  toggleFieldBasedOnBoolean(booleanControlName: string, targetControlName: string) {
    const booleanControl = this.form.get(booleanControlName);
    const targetControl = this.form.get(targetControlName);

    if (booleanControl.value) {
      targetControl.enable();
      targetControl.setValidators(Validators.required);
    } else {
      targetControl.setValue(null);
      targetControl.disable();
      targetControl.clearValidators();
    }
    targetControl.updateValueAndValidity();
  }

  updateFormValidators() {
    if (!this.form) {
      return; // Si el formulario aún no está inicializado, simplemente regresa
    }
    this.form.updateValueAndValidity();
  }

  onSubmit(event) {
    // prevent default submit action
    event.preventDefault();
    // validate form
    if (this.form.invalid) {
      return;
    }
    // emit new block
    const newBlock: Block = {
      ...this.form.value,
      color: this.color,
      time: this.form.value.time === 0 ? -1 : this.form.value.time,
      puzzleTimes: {
        total: this.form.value.puzzleTime,
        warningOn: this.form.value.puzzleTime / 2,
        dangerOn: this.form.value.puzzleTime / 4
      }
    };
    this.modalController.dismiss(newBlock);
  }

  close() {
    this.modalController.dismiss();
  }
}
