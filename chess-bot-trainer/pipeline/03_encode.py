#!/usr/bin/env python3
"""
Step 3: Encode game records into training tensors.

Usage:
  python pipeline/03_encode.py --username DrNykterstein --platform lichess
"""

import argparse
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.encoder.dataset_builder import build_dataset, save_dataset


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    args = parser.parse_args()

    slug = f"{args.username.lower()}_{args.platform}"
    games_path = Path("data/processed") / slug / "games.pkl"
    encoded_dir = Path("data/encoded") / slug

    if not games_path.exists():
        print(f"Error: {games_path} not found. Run 02_parse.py first.")
        sys.exit(1)

    print(f"\n=== Encoding positions for {slug} ===")

    with open(games_path, "rb") as f:
        games = pickle.load(f)

    X, y_policy, y_value = build_dataset(games, shuffle=True)
    save_dataset(X, y_policy, y_value, encoded_dir)

    print(f"\nDataset shape: X={X.shape}, policy={y_policy.shape}, value={y_value.shape}")
    print(f"Next: python pipeline/04_train.py --username {args.username} --platform {args.platform}")


if __name__ == "__main__":
    main()
