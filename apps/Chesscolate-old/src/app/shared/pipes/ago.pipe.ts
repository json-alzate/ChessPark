import { Pipe, PipeTransform } from '@angular/core';

import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'ago'
})
export class AgoPipe implements PipeTransform {

  constructor(private translateService: TranslateService) { }

  transform(date: number | Date, locale?: string): string {

    if (!locale) {
      locale = this.translateService.currentLang;
    }

    return formatDistanceToNow(
      date,
      { includeSeconds: true, addSuffix: true, locale: locale === 'es' ? es : enUS }
    ).replace('hace alrededor de', 'alrededor de');
  }

}
