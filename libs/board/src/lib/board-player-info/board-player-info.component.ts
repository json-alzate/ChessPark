import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Barra con el nick, el rating y el reloj de un jugador, para poner arriba y
 * abajo de un tablero de solo mirar —como en chess.com o lichess—.
 *
 * Sin avatar: los datos de la partida no traen foto de perfil, y unas
 * iniciales genéricas no sumaban nada que el propio nick no diga ya.
 *
 * El reloj es cosa de quien usa el componente: no cambia solo, así que al
 * pasarle por jugada el valor que corresponde a la posición que se está
 * viendo, se ve "andar" igual que en una partida en vivo.
 */
@Component({
  selector: 'lib-board-player-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board-player-info.component.html',
  styleUrl: './board-player-info.component.scss',
})
export class BoardPlayerInfoComponent {
  @Input() name = '';
  @Input() rating: number | null = null;
  @Input() clock = '';
}
