import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'flagUrl'
})
export class FlagUrlPipe implements PipeTransform {

  transform(country: string): string {
    country = country.replace(/\s/g, '_');
    return 'assets/images/flags/round_64/' + country.toLowerCase() + '_64.png';
  }

}
