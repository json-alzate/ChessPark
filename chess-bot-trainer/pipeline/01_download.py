#!/usr/bin/env python3
"""
Step 1: Download games from Lichess or Chess.com.

Usage:
  python pipeline/01_download.py --platform lichess --username DrNykterstein
  python pipeline/01_download.py --platform chesscom --username magnuscarlsen
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.downloader.lichess_client import download_games as lichess_download
from src.downloader.chesscom_client import download_games as chesscom_download


def main():
    parser = argparse.ArgumentParser(description="Download chess games for bot training")
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    parser.add_argument("--username", required=True, help="Player username on the platform")
    parser.add_argument("--max-games", type=int, default=5000)
    parser.add_argument("--token", default=None, help="Lichess OAuth token (optional but recommended)")
    args = parser.parse_args()

    slug = f"{args.username.lower()}_{args.platform}"
    output_path = Path("data/raw") / f"{slug}.pgn"

    print(f"\n=== Downloading {args.username} from {args.platform} ===")

    if args.platform == "lichess":
        token = args.token or os.environ.get("LICHESS_TOKEN")
        count = lichess_download(
            username=args.username,
            output_path=output_path,
            token=token,
            max_games=args.max_games,
        )
    else:
        count = chesscom_download(
            username=args.username,
            output_path=output_path,
            max_games=args.max_games,
        )

    print(f"\nDone. {count} games saved to {output_path}")
    print(f"Next: python pipeline/02_parse.py --username {args.username} --platform {args.platform}")


if __name__ == "__main__":
    main()
