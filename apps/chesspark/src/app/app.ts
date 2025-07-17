import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';
import { BoardComponent } from '@chesspark/board';


@Component({
  imports: [NxWelcome, BoardComponent, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {

  protected title = 'chesspark';
}
