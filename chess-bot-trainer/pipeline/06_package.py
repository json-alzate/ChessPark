#!/usr/bin/env python3
"""
Step 6: Package bot bundle (model + opening book + profile).

Usage:
  python pipeline/06_package.py \
    --username DrNykterstein \
    --platform lichess \
    --display-name "Magnus Carlsen" \
    --elo-blitz 2882 \
    --elo-rapid 2900
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.packager.bot_metadata import generate_profile, save_profile
from src.encoder.dataset_builder import load_dataset


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    parser.add_argument("--display-name", required=True, help="Human-readable bot name")
    parser.add_argument("--elo-blitz", type=int, default=None)
    parser.add_argument("--elo-rapid", type=int, default=None)
    parser.add_argument("--elo-classical", type=int, default=None)
    parser.add_argument("--description", default="")
    args = parser.parse_args()

    slug = f"{args.username.lower()}_{args.platform}"
    bot_dir = Path("data/bots") / slug
    processed_dir = Path("data/processed") / slug
    encoded_dir = Path("data/encoded") / slug

    # Verify required files exist
    model_json = bot_dir / "model" / "model.json"
    book_src = processed_dir / "opening_book.json"

    if not model_json.exists():
        print(f"Error: {model_json} not found. Run 05_export.py first.")
        sys.exit(1)
    if not book_src.exists():
        print(f"Error: {book_src} not found. Run 02_parse.py first.")
        sys.exit(1)

    print(f"\n=== Packaging bot bundle for {slug} ===")

    # Copy opening book to bot dir
    shutil.copy2(book_src, bot_dir / "opening_book.json")
    print(f"  Copied opening_book.json")

    # Read book stats
    with open(bot_dir / "opening_book.json") as f:
        book = json.load(f)
    book_positions = len(book.get("tree", {}))
    games_used = book.get("total_games", 0)

    # Compute model size
    shard_files = list((bot_dir / "model").glob("group*.bin"))
    model_size_bytes = sum(f.stat().st_size for f in shard_files)

    # Best validation accuracy from training logs (approximate if not available)
    top_move_accuracy = 0.0
    metrics_path = Path("data/saved_models") / slug / "training_metrics.json"
    if metrics_path.exists():
        with open(metrics_path) as f:
            metrics = json.load(f)
            top_move_accuracy = metrics.get("best_val_accuracy", 0.0)

    # Build estimated ELO
    estimated_elo = {}
    if args.elo_blitz:
        estimated_elo["blitz"] = args.elo_blitz
    if args.elo_rapid:
        estimated_elo["rapid"] = args.elo_rapid
    if args.elo_classical:
        estimated_elo["classical"] = args.elo_classical

    # Generate and save profile
    profile = generate_profile(
        slug=slug,
        platform=args.platform,
        username=args.username,
        display_name=args.display_name,
        estimated_elo=estimated_elo,
        games_used=games_used,
        top_move_accuracy=top_move_accuracy,
        model_path="model/model.json",
        model_size_bytes=model_size_bytes,
        opening_book_positions=book_positions,
        opening_book_max_depth=15,
        description=args.description,
    )

    save_profile(profile, bot_dir / "bot_profile.json")

    # Summary
    print(f"\n=== Bundle ready at {bot_dir} ===")
    print(f"  Games used:       {games_used}")
    print(f"  Opening positions: {book_positions}")
    print(f"  Model size:        {model_size_bytes / (1024*1024):.1f} MB")
    print(f"  Shards:            {len(shard_files)}")
    print(f"\nTo use in ChessPark, copy {bot_dir} to:")
    print(f"  apps/chess-bot-studio/src/assets/bots/{slug}/")


if __name__ == "__main__":
    main()
