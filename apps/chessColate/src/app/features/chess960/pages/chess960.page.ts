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
import { AnalyticsService } from '@core/analytics/analytics.service';

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

  constructor(
    private router: Router,
    private http: HttpClient,
    private analyticsService: AnalyticsService
  ) {}

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
    // Campo vacío o no numérico mientras se escribe: no hay posición que cargar ni evento que registrar
    if (!Number.isFinite(this.currentPositionId)) return;
    // La posición es un entero de 0 a 959: un decimal (1.5) se trunca y lo de fuera de rango se recorta
    this.currentPositionId = Math.min(959, Math.max(0, Math.trunc(this.currentPositionId)));
    this.loadPosition(this.currentPositionId);
    void this.analyticsService.logEvent('chess960_position_changed', {
      position_id: this.currentPositionId,
      source: 'manual',
    });
  }

  randomizePosition() {
    const randomId = Math.floor(Math.random() * 960);
    this.loadPosition(randomId);
    void this.analyticsService.logEvent('chess960_position_changed', {
      position_id: randomId,
      source: 'random',
    });
  }

  goToHome() {
    this.router.navigate(['/home']);
  }
}
