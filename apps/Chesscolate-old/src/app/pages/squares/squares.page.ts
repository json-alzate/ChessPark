import { Component, OnInit, ElementRef, ViewChildren, QueryList, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

import { Meta } from '@angular/platform-browser';


import { IonCard, Platform, Gesture, GestureController, AlertController } from '@ionic/angular';


import { interval, Subscription } from 'rxjs';


import { SoundsService } from '@services/sounds.service';
import { SquaresService } from '@services/squares.service';

interface SquareColorMap {
  name: string;
  color: string;
}

@Component({
  selector: 'app-squares',
  templateUrl: './squares.page.html',
  styleUrls: ['./squares.page.scss'],
})
export class SquaresPage implements OnInit, AfterViewInit, OnDestroy {

  // Tus casillas
  public squares: SquareColorMap[] = [];
  squaresColorsMap: SquareColorMap[] = this.getSquaresColorsMap();
  gameStatus: 'waiting' | 'playing' | 'win' | 'lose' = 'waiting';

  timeLeft = 60;
  timerSubscription: Subscription;

  isTimerStarted = false;
  score = 0;


  @ViewChildren(IonCard, { read: ElementRef }) cards: QueryList<ElementRef>;

  constructor(
    private platform: Platform,
    private gestureCtrl: GestureController,
    private soundsService: SoundsService,
    private squaresService: SquaresService,
    private alertController: AlertController,
    private meta: Meta,
    private router: Router) {
    this.generateSquares();
  }

  ngOnInit() {
    this.meta.addTags([
      { name: 'title', content: 'ChessColate' },
      { name: 'description', content: 'Jugar a reconocer los colores de cada casilla de un tablero de ajedrez.' },
      { name: 'keywords', content: 'ajedrez, entrenamiento, casillas, chess, board, squares' },
      { name: 'robots', content: 'index, nofollow' },
      { property: 'og:title', content: 'ChessColate' },
      { property: 'og:description', content: 'Jugar a reconocer los colores de cada casilla de un tablero de ajedrez.' },
      { property: 'og:image', content: 'https://chesscolate.com/assets/tags/chesscolate.jpg' },
      { property: 'og:url', content: 'https://chesscolate.com/squares/training' }
    ]);
    this.router.events.forEach(item => {
      if (item instanceof NavigationEnd) {
        // TODO: track event

      }
    });
  }

  ngAfterViewInit() {
    const cardArray = this.cards.toArray();
    this.useSwiperGesture(cardArray);
  }

  generateSquares() {
    // genera 1000 casillar aleatorias con su correspondiente color
    for (let i = 0; i < 1000; i++) {
      const randomIndex = Math.floor(Math.random() * this.squaresColorsMap.length);
      this.squares.push(this.squaresColorsMap[randomIndex]);
    }
  }

  useSwiperGesture(cardArray: ElementRef[]) {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < cardArray.length; i++) {
      const card = cardArray[i];

      const gesture: Gesture = this.gestureCtrl.create({
        el: card.nativeElement,
        threshold: 15,
        gestureName: 'swipe',
        onMove: ev => {
          card.nativeElement.style.transform = `translateX(${ev.deltaX}px) rotate(${ev.deltaX / 10}deg)`;
          this.setCardColor(ev.deltaX, card.nativeElement);
          if (!this.isTimerStarted) {
            this.isTimerStarted = true;
            this.startTimer();
          }

        },
        onEnd: ev => {
          let movement: 'right' | 'left';

          card.nativeElement.style.transition = '.5s ease-out';

          if (ev.deltaX > 250) {
            card.nativeElement.style.transform = `translateX(${this.platform.width() * 2}px) rotate(${ev.deltaX / 2}deg)`;
            // Aquí puedes agregar la lógica para cuando el usuario adivina que la casilla es blanca
            movement = 'right';

          } else if (ev.deltaX < -250) {
            card.nativeElement.style.transform = `translateX(-${this.platform.width() * 2}px) rotate(${ev.deltaX / 2}deg)`;
            // Aquí puedes agregar la lógica para cuando el usuario adivina que la casilla es negra
            movement = 'left';
          } else {
            card.nativeElement.style.transform = '';
          }
          if (movement) {

            if (this.squares[i].color === 'white' && movement === 'right') {
              this.gameStatus = 'win';
              this.score++;
              this.soundsService.playSelect();
            } else if (this.squares[i].color === 'black' && movement === 'left') {
              this.gameStatus = 'win';
              this.score++;
              this.soundsService.playSelect();
            } else {
              this.gameStatus = 'lose';
              this.soundsService.playError();
            }

          }


          // this.checkGuess(movement, this.squares[i].name);
          card.nativeElement.style.background = '';
        }

      });

      gesture.enable(true);
    }
  }


  getSquaresColorsMap(): SquareColorMap[] {
    // Aquí puedes agregar la lógica para saber si la casilla es blanca o negra
    const squaresColorsMap: SquareColorMap[] = [];

    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const colors = ['white', 'black'];

    for (let row = 1; row <= 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = letters[col] + row;
        const color = colors[(row + col) % 2];
        const toAdd = { name: square, color };
        squaresColorsMap.push(toAdd);
      }
    }

    return squaresColorsMap;

  }

  setCardColor(deltaX: number, element: HTMLElement) {
    let color = '';
    const opacity = Math.min(Math.abs(deltaX) / 1000, 1);

    if (deltaX > 0) {
      color = `rgba(255, 255, 255, ${opacity})`; // white
    } else {
      color = `rgba(160, 109, 42, ${opacity})`; // brown
    }
    element.style.background = color;
  }

  decimalToHex(d: number, padding: number) {
    let hex = Number(d).toString(16);
    padding = typeof padding === 'undefined' || padding === null ? (padding = 2) : padding;
    while (hex.length < padding) {
      hex = '0' + hex;
    }
    return hex;
  }


  startTimer() {
    const timer$ = interval(1000);
    this.timerSubscription = timer$.subscribe((elapsed) => {
      this.timeLeft = 60 - elapsed;
      if (this.timeLeft <= 0) {
        this.showAlertEndGame();
        this.squaresService.saveScore(this.score);
        this.score = 0;
        this.timeLeft = 60;
        this.isTimerStarted = false;
        this.timerSubscription.unsubscribe();
      }
    });
  }

  async showAlertEndGame() {
    const alert = await this.alertController.create({
      header: `${this.score}`,
      buttons: ['OK']
    });

    await alert.present();
  }


  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }





}
