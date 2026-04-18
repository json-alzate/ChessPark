import { Injectable } from '@angular/core';
import { OpeningBook, OpeningBookNode } from './types/bot.types';

@Injectable({ providedIn: 'root' })
export class OpeningBookService {
  private book: OpeningBook | null = null;

  load(data: OpeningBook): void {
    this.book = data;
  }

  unload(): void {
    this.book = null;
  }

  /**
   * Given a FEN, returns a move sampled proportionally to how often
   * the player chose each move in that position.
   * Returns null if the position is not in the book.
   */
  lookup(fen: string): string | null {
    if (!this.book) return null;

    // Normalize FEN: strip halfmove/fullmove counters for lookup
    const normalizedFen = this.normalizeFen(fen);
    const node = this.book.tree[normalizedFen];
    if (!node) return null;

    const moves = Object.keys(node);
    if (moves.length === 0) return null;

    return this.weightedSample(node, moves);
  }

  private weightedSample(node: OpeningBookNode, moves: string[]): string {
    const totalCount = moves.reduce((sum, m) => sum + node[m].count, 0);
    let rand = Math.random() * totalCount;

    for (const move of moves) {
      rand -= node[move].count;
      if (rand <= 0) return move;
    }

    return moves[moves.length - 1];
  }

  /**
   * Strip halfmove clock and fullmove counter from FEN so the book lookup
   * is position-only (the training pipeline stores keys this way).
   */
  private normalizeFen(fen: string): string {
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }
}
