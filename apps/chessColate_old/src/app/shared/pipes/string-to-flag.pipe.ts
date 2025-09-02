import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stringToFlag'
})
export class StringToFlagPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    // TODO: converstir un string de 3 caracteres en la url de un flag en firestore
    return null;
  }

}
