import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { ModalController, IonContent, IonIcon } from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Block } from '@cpark/models';
import { PuzzleThemesGroup } from '@cpark/models';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { TranslocoService } from '@jsverse/transloco';
import { AppService } from '@services/app.service';

import { addIcons } from 'ionicons';
import { close, shuffle, trendingDown, infiniteOutline } from 'ionicons/icons';

@Component({
  selector: 'app-block-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    SecondsToMinutesSecondsPipe,
    IonContent,
    IonIcon,
  ],
  templateUrl: './block-settings.component.html',
  styleUrl: './block-settings.component.scss',
})
export class BlockSettingsComponent implements OnInit, AfterViewInit {
  @ViewChild('themeDetails') themeDetailsEl!: ElementRef<HTMLDetailsElement>;
  private formBuilder = inject(FormBuilder);
  private appService = inject(AppService);
  private modalController = inject(ModalController);
  private translocoService = inject(TranslocoService);

  color: 'white' | 'black' | 'random' = 'random';
  puzzlesGroupsThemes: PuzzleThemesGroup[] = [];
  form!: FormGroup;

  get lang(): string {
    return this.translocoService.getActiveLang() ?? 'es';
  }

  constructor() {
    addIcons({ close, shuffle, trendingDown, infiniteOutline });
  }

  ngOnInit(): void {
    this.puzzlesGroupsThemes = this.appService.getThemesPuzzle ?? [];
    this.buildForm();
    this.form.get('goshPuzzle')?.valueChanges.subscribe(() => {
      this.toggleFieldBasedOnBoolean('goshPuzzle', 'goshPuzzleTime');
    });
    this.form.get('showPuzzleSolution')?.valueChanges.subscribe((val) => {
      if (val) this.form.get('streamSolution')?.setValue(false, { emitEvent: false });
    });
    this.form.get('streamSolution')?.valueChanges.subscribe((val) => {
      if (val) this.form.get('showPuzzleSolution')?.setValue(false, { emitEvent: false });
    });
    this.form.get('eloMin')?.valueChanges.subscribe((val) => {
      if (val > this.form.get('eloMax')?.value) {
        this.form.get('eloMax')?.setValue(val, { emitEvent: false });
      }
    });
    this.form.get('eloMax')?.valueChanges.subscribe((val) => {
      if (val < this.form.get('eloMin')?.value) {
        this.form.get('eloMin')?.setValue(val, { emitEvent: false });
      }
    });
  }

  ngAfterViewInit(): void {
    this.form.get('theme')?.valueChanges.subscribe(() => {
      if (this.themeDetailsEl?.nativeElement) {
        this.themeDetailsEl.nativeElement.open = false;
      }
    });
  }

  getThemeName(value: string): string {
    if (value === 'all') return '';
    if (value === 'weakness') return '';
    return this.appService.getNameThemePuzzleByValue(value) || '';
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
  get eloMinField() {
    return this.form.get('eloMin');
  }
  get eloMaxField() {
    return this.form.get('eloMax');
  }
  get puzzleTimeField() {
    return this.form.get('puzzleTime');
  }
  get goshPuzzleTimeField() {
    return this.form.get('goshPuzzleTime');
  }

  private buildForm(): void {
    this.form = this.formBuilder.group({
      time: [300, Validators.required],
      puzzlesCount: [0],
      eloMin: [1200, Validators.required],
      eloMax: [1800, Validators.required],
      theme: ['all'],
      openingFamily: [''],
      puzzleTime: [60, Validators.required],
      nextPuzzleImmediately: [true],
      showPuzzleSolution: [true],
      streamSolution: [false],
      showPuzzleElo: [false],
      goshPuzzle: [false],
      goshPuzzleTime: [{ value: 30, disabled: true }],
    });
  }

  private toggleFieldBasedOnBoolean(booleanControlName: string, targetControlName: string): void {
    const booleanControl = this.form.get(booleanControlName);
    const targetControl = this.form.get(targetControlName);
    if (!booleanControl || !targetControl) return;
    if (booleanControl.value) {
      targetControl.enable();
      targetControl.setValidators(Validators.required);
    } else {
      targetControl.setValue(30);
      targetControl.disable();
      targetControl.clearValidators();
    }
    targetControl.updateValueAndValidity();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const newBlock: Block = {
      ...val,
      color: this.color,
      time: val.time === 0 ? -1 : val.time,
      puzzlesCount: val.puzzlesCount ?? 0,
      elo: Math.round((val.eloMin + val.eloMax) / 2),
      eloMin: val.eloMin,
      eloMax: val.eloMax,
      puzzleTimes: {
        total: val.puzzleTime,
        warningOn: val.puzzleTime / 2,
        dangerOn: val.puzzleTime / 4,
      },
      puzzlesPlayed: [],
    };
    this.modalController.dismiss(newBlock);
  }

  close(): void {
    this.modalController.dismiss();
  }
}
