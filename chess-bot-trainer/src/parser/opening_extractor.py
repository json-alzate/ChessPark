"""
Builds an opening book from parsed PGN games.
The book is a FEN-keyed dict of move frequencies from the player's games.
"""

from collections import defaultdict
from pathlib import Path
from typing import Iterator
import json

import chess
import chess.pgn

from .pgn_parser import GameRecord


MAX_OPENING_DEPTH = 15  # Half-moves to record per game


def build_opening_book(games: list[GameRecord], player: str) -> dict:
    """
    Returns an opening book dict ready to serialize as opening_book.json.

    Structure:
      {
        "version": 1,
        "player": "username",
        "total_games": N,
        "tree": {
          "<normalized_fen>": {
            "<uci_move>": {"count": N, "wins": N, "draws": N, "losses": N}
          }
        }
      }
    """
    tree: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"count": 0, "wins": 0, "draws": 0, "losses": 0}))

    for game in games:
        for move_rec in game.moves:
            if move_rec.ply >= MAX_OPENING_DEPTH:
                break

            norm_fen = _normalize_fen(move_rec.fen)
            entry = tree[norm_fen][move_rec.move]
            entry["count"] += 1

            if game.result == 1.0:
                entry["wins"] += 1
            elif game.result == 0.5:
                entry["draws"] += 1
            else:
                entry["losses"] += 1

    # Filter positions with only 1 occurrence (too noisy)
    filtered_tree = {}
    for fen, moves in tree.items():
        filtered_moves = {m: v for m, v in moves.items() if v["count"] >= 2}
        if filtered_moves:
            filtered_tree[fen] = filtered_moves

    return {
        "version": 1,
        "player": player,
        "total_games": len(games),
        "tree": filtered_tree,
    }


def _normalize_fen(fen: str) -> str:
    """Strip halfmove clock and fullmove counter — position identity only."""
    parts = fen.split(" ")
    return " ".join(parts[:4])
