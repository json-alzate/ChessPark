"""
Parses PGN files into structured GameRecord objects.
Only standard chess — variants are skipped.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

import chess
import chess.pgn

# Variants to skip. These appear in the [Variant] PGN header.
EXCLUDED_VARIANTS = {
    "Chess960", "From Position", "King of the Hill", "Three-check",
    "Antichess", "Atomic", "Horde", "Racing Kings", "Crazyhouse",
    "chess960", "kingofthehill", "threecheck", "bughouse", "crazyhouse",
}


@dataclass
class MoveRecord:
    fen: str       # Position before the move
    move: str      # Move played in UCI format (e.g. "e2e4")
    ply: int       # Half-move number


@dataclass
class GameRecord:
    player: str
    player_color: str          # "white" or "black"
    opponent_rating: int
    result: float              # 1.0 win, 0.5 draw, 0.0 loss (from player's perspective)
    eco: str
    opening: str
    time_control: str
    moves: list[MoveRecord] = field(default_factory=list)


def parse_pgn_file(
    pgn_path: Path,
    player_username: str,
    min_moves: int = 10,
) -> Iterator[GameRecord]:
    """
    Yields GameRecord objects for each valid standard chess game in the PGN file.

    Filters out:
    - Chess variants
    - Games shorter than min_moves (half-moves)
    - Games without a recognizable result
    """
    with open(pgn_path, encoding="utf-8", errors="ignore") as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break

            record = _process_game(game, player_username, min_moves)
            if record is not None:
                yield record


def _process_game(
    game: chess.pgn.Game,
    player_username: str,
    min_moves: int,
) -> GameRecord | None:
    headers = game.headers

    # Skip variants
    variant = headers.get("Variant", "Standard")
    if variant in EXCLUDED_VARIANTS:
        return None

    # Identify player color
    white = headers.get("White", "").lower()
    black = headers.get("Black", "").lower()
    username_lower = player_username.lower()

    if username_lower in white:
        player_color = "white"
    elif username_lower in black:
        player_color = "black"
    else:
        return None  # Player not found in this game

    # Parse result
    result_str = headers.get("Result", "*")
    result = _parse_result(result_str, player_color)
    if result is None:
        return None

    # Opponent rating
    opp_rating_key = "BlackElo" if player_color == "white" else "WhiteElo"
    try:
        opponent_rating = int(headers.get(opp_rating_key, 1500))
    except ValueError:
        opponent_rating = 1500

    record = GameRecord(
        player=player_username,
        player_color=player_color,
        opponent_rating=opponent_rating,
        result=result,
        eco=headers.get("ECO", ""),
        opening=headers.get("Opening", ""),
        time_control=headers.get("TimeControl", ""),
    )

    # Walk through moves
    board = game.board()
    for node in game.mainline():
        if not isinstance(node, chess.pgn.ChildNode):
            continue

        move = node.move
        # Only record moves made by the target player
        is_players_turn = (
            (player_color == "white" and board.turn == chess.WHITE) or
            (player_color == "black" and board.turn == chess.BLACK)
        )

        if is_players_turn:
            record.moves.append(MoveRecord(
                fen=board.fen(),
                move=move.uci(),
                ply=board.ply(),
            ))

        board.push(move)

    if len(record.moves) < min_moves // 2:
        return None

    return record


def _parse_result(result_str: str, player_color: str) -> float | None:
    if result_str == "1-0":
        return 1.0 if player_color == "white" else 0.0
    if result_str == "0-1":
        return 0.0 if player_color == "white" else 1.0
    if result_str == "1/2-1/2":
        return 0.5
    return None
