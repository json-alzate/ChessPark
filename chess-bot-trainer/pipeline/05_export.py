#!/usr/bin/env python3
"""
Step 5: Export trained model to TF.js graph model format.

Usage:
  python pipeline/05_export.py --username DrNykterstein --platform lichess
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.exporter.tfjs_converter import convert_to_tfjs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    parser.add_argument("--no-quantize", action="store_true", help="Skip float16 quantization")
    parser.add_argument("--shard-mb", type=int, default=5, help="Weight shard size in MB")
    args = parser.parse_args()

    slug = f"{args.username.lower()}_{args.platform}"
    saved_model_path = Path("data/saved_models") / slug
    tfjs_output = Path("data/bots") / slug / "model"

    if not saved_model_path.exists():
        print(f"Error: Saved model not found at {saved_model_path}. Run 04_train.py first.")
        sys.exit(1)

    print(f"\n=== Exporting TF.js model for {slug} ===")

    convert_to_tfjs(
        saved_model_path=saved_model_path,
        output_path=tfjs_output,
        quantize=not args.no_quantize,
        shard_size_mb=args.shard_mb,
    )

    print(f"\nNext: python pipeline/06_package.py --username {args.username} --platform {args.platform}")


if __name__ == "__main__":
    main()
