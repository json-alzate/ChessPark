"""
Converts parsed GameRecords into a tf.data.Dataset.
Produces (board_tensor, policy_target) pairs for training.
"""

from pathlib import Path
import numpy as np

from ..parser.pgn_parser import GameRecord
from .board_encoder import encode_fen
from .move_encoder import build_policy_target


def build_dataset(games: list[GameRecord], shuffle: bool = True):
    """
    Returns a tuple (X, y_policy, y_value):
      X         : np.ndarray shape (N, 8, 8, 20) — board positions
      y_policy  : np.ndarray shape (N, 4096)     — one-hot move targets
      y_value   : np.ndarray shape (N, 1)        — game result from player POV
    """
    positions = []
    policies = []
    values = []

    for game in games:
        for move_rec in game.moves:
            try:
                board_tensor = encode_fen(move_rec.fen)
                policy_target = build_policy_target(move_rec.move)
            except Exception:
                continue  # Skip malformed positions

            positions.append(board_tensor)
            policies.append(policy_target)
            values.append([game.result * 2 - 1])  # Map [0,1] → [-1,+1] for tanh

    X = np.array(positions, dtype=np.float32)
    y_policy = np.array(policies, dtype=np.float32)
    y_value = np.array(values, dtype=np.float32)

    if shuffle:
        indices = np.random.permutation(len(X))
        X = X[indices]
        y_policy = y_policy[indices]
        y_value = y_value[indices]

    print(f"  Dataset: {len(X):,} positions from {len(games):,} games")
    return X, y_policy, y_value


def save_dataset(X: np.ndarray, y_policy: np.ndarray, y_value: np.ndarray, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    np.save(out_dir / "X.npy", X)
    np.save(out_dir / "y_policy.npy", y_policy)
    np.save(out_dir / "y_value.npy", y_value)
    print(f"  Saved dataset to {out_dir}")


def load_dataset(data_dir: Path):
    X = np.load(data_dir / "X.npy")
    y_policy = np.load(data_dir / "y_policy.npy")
    y_value = np.load(data_dir / "y_value.npy")
    return X, y_policy, y_value
