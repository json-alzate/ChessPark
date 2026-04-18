#!/usr/bin/env python3
"""
Step 2: Parse PGN file into structured GameRecords and build the opening book.

Usage:
  python pipeline/02_parse.py --username DrNykterstein --platform lichess
"""

import argparse
import json
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parser.pgn_parser import parse_pgn_file, GameRecord
from src.parser.opening_extractor import build_opening_book


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    parser.add_argument("--min-moves", type=int, default=10, help="Minimum half-moves per game")
    args = parser.parse_args()

    slug = f"{args.username.lower()}_{args.platform}"
    pgn_path = Path("data/raw") / f"{slug}.pgn"
    processed_dir = Path("data/processed") / slug

    if not pgn_path.exists():
        print(f"Error: {pgn_path} not found. Run 01_download.py first.")
        sys.exit(1)

    print(f"\n=== Parsing {pgn_path} ===")
    processed_dir.mkdir(parents=True, exist_ok=True)

    games: list[GameRecord] = list(parse_pgn_file(pgn_path, args.username, args.min_moves))
    print(f"  Parsed {len(games)} valid games")

    # Save game records
    games_path = processed_dir / "games.pkl"
    with open(games_path, "wb") as f:
        pickle.dump(games, f)
    print(f"  Games saved to {games_path}")

    # Build and save opening book
    print("  Building opening book...")
    book = build_opening_book(games, args.username)
    book_path = processed_dir / "opening_book.json"
    with open(book_path, "w") as f:
        json.dump(book, f, indent=2)
    print(f"  Opening book: {len(book['tree'])} positions → {book_path}")

    print(f"\nNext: python pipeline/03_encode.py --username {args.username} --platform {args.platform}")


if __name__ == "__main__":
    main()
