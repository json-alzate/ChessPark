import { Injectable } from '@angular/core';

// @ts-ignore
import { Howl, Howler } from 'howler';

import { Chess } from 'chess.js';

type ChessMoveType = 'castle' | 'check' | 'checkmate' | 'move' | 'capture';

@Injectable({
  providedIn: 'root'
})
export class SoundsService {

  select: Howl;
  error: Howl;
  good: Howl;
  move: Howl;
  capture: Howl;
  check: Howl;
  checkMate: Howl;
  castle: Howl;
  lowTime: Howl;

  constructor() {
    this.loadSounds();
  }

  loadSounds() {

    const basePath = 'assets/sounds/lisp/';

    this.select = new Howl({
      src: [basePath + 'Select.mp3']
    });
    this.error = new Howl({
      src: [basePath + 'Error.mp3']
    });
    this.good = new Howl({
      src: [basePath + 'PuzzleStormGood.mp3']
    });
    this.move = new Howl({
      src: [basePath + 'Move.mp3']
    });
    this.capture = new Howl({
      src: [basePath + 'Capture.mp3']
    });
    this.castle = new Howl({
      src: [basePath + 'Castles.mp3']
    });
    this.check = new Howl({
      src: [basePath + 'Check.mp3']
    });
    this.checkMate = new Howl({
      src: [basePath + 'Victory.mp3']
    });
    this.lowTime = new Howl({
      src: [basePath + 'LowTime.mp3']
    });

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
          if (chess.isCheckmate()) {
            if (playSound) {
              this.playCheckmateSound();
            }
            return 'checkmate';
          }
          if (chess.inCheck()) {
            if (playSound) {
              this.playCheckSound();
            }
            return 'check';
          }
          if (move.flags.includes('k') || move.flags.includes('q')) {
            if (playSound) {
              this.playCastleSound();
            }
            return 'castle';
          }
          if (move.flags.includes('c') || move.flags.includes('e')) {
            if (playSound) {
              this.playCaptureSound();
            }
            return 'capture';
          }
  
        }
  
        chess.undo();
      }
  
      if (playSound) {
        this.playMoveSound();
      }
  
      return 'move';
    }

  playMoveSound() {
    this.move.play();
  }

  playCaptureSound() {
    this.capture.play();
  }

  playCheckSound() {
    this.check.play();
  }

  playCheckmateSound() {
    this.checkMate.play();
  }

  playCastleSound() {
    this.castle.play();
  }



  playSelect() {
    this.select.play();
  }

  playLowTime() {
    this.lowTime.play();
  }

  playError() {
    this.error.play();
  }

  playGood() {
    this.good.play();
  }

}
