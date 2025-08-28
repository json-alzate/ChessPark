import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

// models
import { PiecesStyle, BoardStyle } from '@models/ui.model';

import { UiService } from '@services/ui.service';
import { ProfileService } from '@services/profile.service';


@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {

  @Output() closeProfile = new EventEmitter();
  @Input() currentLanguage = this.translateService.currentLang;

  piecesStylesInfo = this.uiService.piecesStylesInfo;

  boardStylesInfo = this.uiService.boardStylesInfo;


  constructor(
    public uiService: UiService,
    private profileService: ProfileService,
    private translateService: TranslateService
  ) { }

  ngOnInit() { }

  changeLanguage(lang: string) {
    this.currentLanguage = lang;
    this.translateService.use(lang);
    this.profileService.updateProfile({ lang });
  }

  changePiecesStyle(name: PiecesStyle) {
    this.uiService.changePiecesStyle(name);
    this.profileService.updateProfile({ pieces: name });
  }

  changeBoardStyle(name: BoardStyle) {
    this.uiService.changeBoardStyle(name);
    this.profileService.updateProfile({ board: name });
  }

  logout() {
    this.closeProfile.emit();
  }

}
