import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as Chess from 'chess.js';

type ChessMoveType = 'castle' | 'check' | 'checkmate' | 'move' | 'capture';


import { Flag } from '@models/tools.models';

import { SoundsService } from '@services/sounds.service';

@Injectable({
  providedIn: 'root'
})
export class ToolsService {

  flags: Flag[] = [];
  chessInstanceMoveSANToUCI = new Chess();

  constructor(
    private httpClient: HttpClient,
    private soundsService: SoundsService
  ) { }

  /**
   * Carga lar referencias para utilizar las banderas
   */
  loadFlags() {
    this.httpClient.get<Flag[]>('/assets/data/flags.json').subscribe(flags => this.flags = flags);
  }

  /**
   * Valida el tipo de movimiento entre dos FEN
   */
  determineChessMoveType(previousFen: string, currentFen: string, playSound = true): ChessMoveType {
    const chess = new Chess(previousFen);
    const legalMoves = chess.moves({ verbose: true });

    // let toReturn: ChessMoveType = 'move';

    for (const move of legalMoves) {

      chess.move(move);
      if (chess.fen() === currentFen) {
        if (chess.in_checkmate()) {
          if (playSound) {
            this.soundsService.playCheckmateSound();
          }
          return 'checkmate';
        }
        if (chess.in_check()) {
          if (playSound) {
            this.soundsService.playCheckSound();
          }
          return 'check';
        }
        if (move.flags.includes('k') || move.flags.includes('q')) {
          if (playSound) {
            this.soundsService.playCastleSound();
          }
          return 'castle';
        }
        if (move.flags.includes('c') || move.flags.includes('e')) {
          if (playSound) {
            this.soundsService.playCaptureSound();
          }
          return 'capture';
        }

      }

      chess.undo();
    }

    if (playSound) {
      this.soundsService.playMoveSound();
    }

    return 'move';
  }

  /**
   *
   * Convierte un movimiento en formato SAN a UCI
   *
   * @param move Movimiento en formato UCI
   * @param fen FEN del tablero
   * @returns Movimiento en formato SAN
   *
   * */
  moveSANToUCI(sanMove: string, fen: string): { from: string; to: string } | null {

    this.chessInstanceMoveSANToUCI.load(fen);

    const move = this.chessInstanceMoveSANToUCI.move(sanMove);
    // Si la jugada es inválida, devuelve null o maneja el error como prefieras
    if (move === null) {
      return null;
    }

    // Devuelve el objeto con las propiedades "from" y "to"
    return { from: move.from, to: move.to };

  }




}
