import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'milliToSeconds'
})
export class MilliToSecondsPipe implements PipeTransform {

  transform(milliSeconds: number): number {
    return Math.floor(milliSeconds / 1000);
  }

}
