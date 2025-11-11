import { Pipe, PipeTransform } from '@angular/core';
import memoize from 'lodash/memoize';

const secondsToMinutesSeconds = memoize(
  (value: number, hideMinutes: boolean) => {
    let seconds = Math.max(Number.isFinite(value) ? value : 0, 0);

    // 👇️ get number of full minutes
    const minutes = Math.floor(seconds / 60);

    // 👇️ get remainder of seconds
    seconds = seconds % 60;

    // 👇️ if hideMinutes is true, return only seconds
    if (hideMinutes) {
      return `${padTo2Digits(seconds)}`;
    }
    return `${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
  },
  (seconds: number, hideMinutes: boolean) => `${seconds}-${hideMinutes}`
);

const padTo2Digits = (num: number) => Math.floor(num).toString().padStart(2, '0'); // 👉️ "09:25"

@Pipe({
  name: 'secondsToMinutesSeconds',
  standalone: true
})
export class SecondsToMinutesSecondsPipe implements PipeTransform {

  transform(seconds: number, hideMinutes = false): string {
    return secondsToMinutesSeconds(seconds, hideMinutes);
  }

}
