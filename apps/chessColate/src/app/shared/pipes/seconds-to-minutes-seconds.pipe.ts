import { Pipe, PipeTransform } from '@angular/core';
// eslint-disable-next-line @typescript-eslint/naming-convention
import * as _ from 'lodash';

const secondsToMinutesSeconds = _.memoize((seconds: number, hideMinutes: boolean) => {
  // 👇️ get number of full minutes
  const minutes = Math.floor(seconds / 60);

  // 👇️ get remainder of seconds
  seconds = seconds % 60;

  // 👇️ if hideMinutes is true, return only seconds
  if (hideMinutes) {
    return `${padTo2Digits(seconds)}`;
  }
  return `${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
});

const padTo2Digits = (num) => num.toString().padStart(2, '0'); // 👉️ "09:25"

@Pipe({
  name: 'secondsToMinutesSeconds'
})
export class SecondsToMinutesSecondsPipe implements PipeTransform {

  transform(seconds: number, hideMinutes = false): string {
    return secondsToMinutesSeconds(seconds, hideMinutes);
  }

}
