import { Pipe, PipeTransform } from '@angular/core';

// Recibe un numero de mili segundos y lo convierte a minutos, segundos o mili segundos según un limite menor


@Pipe({
  name: 'gameClock'
})
export class GameClockPipe implements PipeTransform {

  transform(milliSeconds: number): string {

    let minutes = Math.floor(milliSeconds / 60000);
    const seconds = Number(((milliSeconds % 60000) / 1000).toFixed(0));

    let strSeconds = '00';

    if (seconds === 60) {
      minutes = minutes + 1;
    } else if (seconds >= 10) {
      strSeconds = String(seconds);
    }

    const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;

    return `${strMinutes}:${strSeconds}`;
  }

}
