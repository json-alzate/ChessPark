import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import {
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, refreshOutline, shuffleOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';

import { Chess960Board } from '@chesspark/board';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

addIcons({ homeOutline, refreshOutline, shuffleOutline });

interface Chess960Position {
  id: number;
  fen: string;
}

@Component({
  selector: 'app-chess960',
  templateUrl: './chess960.page.html',
  styleUrls: ['./chess960.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    IonContent,
    Chess960Board,
    NavbarComponent,
    IonIcon,
    TranslocoPipe,
  ],
})
export class Chess960Page implements OnInit {
  positions: Chess960Position[] = [];
  currentPositionId: number = 518; // Default standard chess
  currentFen: string =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  isLoading = true;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.loadPositions();
  }

  loadPositions() {
    this.http.get<Chess960Position[]>('assets/data/chess960.json').subscribe({
      next: (data) => {
        this.positions = data;
        this.isLoading = false;
        this.loadPosition(this.currentPositionId);
      },
      error: (err) => {
        console.error('Failed to load Chess960 positions:', err);
        this.isLoading = false;
      },
    });
  }

  loadPosition(id: number) {
    if (id < 0 || id > 959 || this.positions.length === 0) return;
    this.currentPositionId = id;
    const pos = this.positions.find((p) => p.id === id);
    if (pos) {
      this.currentFen = pos.fen;
    }
  }

  onIdChange() {
    if (this.currentPositionId < 0) this.currentPositionId = 0;
    if (this.currentPositionId > 959) this.currentPositionId = 959;
    this.loadPosition(this.currentPositionId);
  }

  randomizePosition() {
    const randomId = Math.floor(Math.random() * 960);
    this.loadPosition(randomId);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }
}
