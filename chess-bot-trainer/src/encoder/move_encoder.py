"""
Encodes/decodes UCI moves to/from a flat policy index 0–4095.
Must stay in sync with libs/bot-engine/src/lib/move-encoder.ts.

Index = from_square * 64 + to_square
Squares: a1=0, b1=1, ..., h8=63
"""

import chess
import numpy as np


def uci_to_index(uci: str) -> int:
    move = chess.Move.from_uci(uci)
    return move.from_square * 64 + move.to_square


def index_to_uci(index: int) -> str:
    from_sq = index // 64
    to_sq = index % 64
    return chess.Move(from_sq, to_sq).uci()


def build_policy_target(uci: str) -> np.ndarray:
    """One-hot vector of shape (4096,)."""
    target = np.zeros(4096, dtype=np.float32)
    idx = uci_to_index(uci)
    target[idx] = 1.0
    return target


def build_legal_mask(board: chess.Board) -> np.ndarray:
    """Float32 mask of shape (4096,): 1 for legal moves, 0 otherwise."""
    mask = np.zeros(4096, dtype=np.float32)
    for move in board.legal_moves:
        idx = move.from_square * 64 + move.to_square
        mask[idx] = 1.0
    return mask
