import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {



  constructor(
    private translateService: TranslateService
  ) {

  }

  ngOnInit() {
  }

  changeLanguage(lang: string) {
    this.translateService.use(lang);
  }

}
