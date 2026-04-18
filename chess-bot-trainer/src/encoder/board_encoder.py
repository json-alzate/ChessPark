"""
Encodes a chess position (FEN) as an 8×8×20 numpy array.
Must stay in sync with libs/bot-engine/src/lib/board-encoder.ts.

Channels:
  0-5  : white pieces (P, N, B, R, Q, K)
  6-11 : black pieces (p, n, b, r, q, k)
  12   : side to move (1=white, 0=black)
  13   : castling white kingside
  14   : castling white queenside
  15   : castling black kingside
  16   : castling black queenside
  17   : en passant file
  18   : halfmove clock normalized [0, 1]
  19   : fullmove number normalized [0, 1]
"""

import numpy as np
import chess

PIECE_CHANNEL = {
    chess.PAWN:   {chess.WHITE: 0, chess.BLACK: 6},
    chess.KNIGHT: {chess.WHITE: 1, chess.BLACK: 7},
    chess.BISHOP: {chess.WHITE: 2, chess.BLACK: 8},
    chess.ROOK:   {chess.WHITE: 3, chess.BLACK: 9},
    chess.QUEEN:  {chess.WHITE: 4, chess.BLACK: 10},
    chess.KING:   {chess.WHITE: 5, chess.BLACK: 11},
}


def encode_fen(fen: str) -> np.ndarray:
    """Returns shape (8, 8, 20) float32 array."""
    board = chess.Board(fen)
    tensor = np.zeros((8, 8, 20), dtype=np.float32)

    # Piece planes
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece is None:
            continue
        rank = chess.square_rank(square)
        file = chess.square_file(square)
        channel = PIECE_CHANNEL[piece.piece_type][piece.color]
        tensor[rank, file, channel] = 1.0

    # Side to move
    tensor[:, :, 12] = 1.0 if board.turn == chess.WHITE else 0.0

    # Castling rights
    if board.has_kingside_castling_rights(chess.WHITE):
        tensor[:, :, 13] = 1.0
    if board.has_queenside_castling_rights(chess.WHITE):
        tensor[:, :, 14] = 1.0
    if board.has_kingside_castling_rights(chess.BLACK):
        tensor[:, :, 15] = 1.0
    if board.has_queenside_castling_rights(chess.BLACK):
        tensor[:, :, 16] = 1.0

    # En passant
    if board.ep_square is not None:
        ep_file = chess.square_file(board.ep_square)
        tensor[:, ep_file, 17] = 1.0

    # Clocks
    tensor[:, :, 18] = min(board.halfmove_clock / 100.0, 1.0)
    tensor[:, :, 19] = min(board.fullmove_number / 100.0, 1.0)

    return tensor


def encode_batch(fens: list[str]) -> np.ndarray:
    """Returns shape (N, 8, 8, 20) float32 array."""
    return np.stack([encode_fen(fen) for fen in fens])
