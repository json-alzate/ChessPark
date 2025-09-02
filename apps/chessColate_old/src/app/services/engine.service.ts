import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { Evaluation } from '@models/engine.model';

@Injectable({
  providedIn: 'root'
})
export class EngineService {

  engineReady = false;
  engineWorking = false;

  private lozza: Worker;

  constructor() {

  }

  init() {
    if (this.lozza) {
      this.stopEvaluation();
      this.terminateWorker();
    }
    this.lozza = new Worker('assets/engine/lozza.js');
    this.engineReady = true;
  }

  getBestMove(fen: string): Observable<Evaluation> {

    if (this.lozza) {
      this.stopEvaluation();
    }
    this.init();

    return new Observable((observer) => {
      // Configurar el manejador de mensajes para recibir la respuesta de Lozza
      this.lozza.onmessage = (event: any) => {
        const message = event.data;

        // console.log('EngineService.getBestMove.onmessage: ', message);
        // Verificar si el mensaje tiene el formato requerido
        if (message.startsWith('info depth') && message.includes('score cp') && message.includes('pv')) {
          // Procesar el mensaje y extraer la información necesaria
          const parts = message.split(' ');
          const bestMove = parts[parts.indexOf('pv') + 1];
          const score = parts[parts.indexOf('score') + 2];
          const moves = parts.slice(parts.indexOf('pv') + 1);

          // Emitir la evaluación
          observer.next({ bestMove, score: score / 100, moves });
        }
      };

      // Enviar el comando FEN a Lozza
      this.lozza.postMessage(`position fen ${fen}`);
      this.lozza.postMessage('go');
      this.engineWorking = true;
    });
  }

  stopEvaluation(): void {
    this.lozza.postMessage('quit');
    this.lozza.onmessage = null;
    this.engineWorking = false;
    this.terminateWorker();
  }

  terminateWorker(): void {
    if (this.lozza) {
      this.lozza.terminate();
      this.lozza = null;
    }
  }



}
