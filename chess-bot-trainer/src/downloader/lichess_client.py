"""
Downloads games from the Lichess API for a given username.
Standard chess only — variants are filtered at download time.
"""

import os
import time
from pathlib import Path
from typing import Iterator

import requests
from tqdm import tqdm

# Lichess supports streaming NDJSON. We request PGN text format.
LICHESS_API = "https://lichess.org/api/games/user/{username}"

# Only standard chess time controls. Excludes chess960, horde, etc.
STANDARD_PERF_TYPES = "ultraBullet,bullet,blitz,rapid,classical,correspondence"

# Variant names that appear in PGN headers — used as a second filter pass
EXCLUDED_VARIANTS = {
    "Chess960", "From Position", "King of the Hill", "Three-check",
    "Antichess", "Atomic", "Horde", "Racing Kings", "Crazyhouse",
}


def download_games(
    username: str,
    output_path: Path,
    token: str | None = None,
    max_games: int = 5000,
    rated_only: bool = True,
) -> int:
    """
    Downloads up to max_games standard chess games for username from Lichess.
    Streams directly to output_path to avoid memory issues with large histories.

    Returns the number of games written.
    """
    headers = {"Accept": "application/x-chess-pgn"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params = {
        "max": max_games,
        "perfType": STANDARD_PERF_TYPES,
        "opening": "true",
        "clocks": "false",
        "evals": "false",
    }
    if rated_only:
        params["rated"] = "true"

    url = LICHESS_API.format(username=username)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    game_count = 0
    buffer: list[str] = []

    with requests.get(url, headers=headers, params=params, stream=True, timeout=60) as resp:
        resp.raise_for_status()

        with open(output_path, "w", encoding="utf-8") as f:
            pbar = tqdm(desc=f"Downloading {username}@lichess", unit="games")

            for line in resp.iter_lines(decode_unicode=True):
                line_str = line if isinstance(line, str) else line.decode("utf-8")
                buffer.append(line_str)

                # Each game ends with a blank line after the move text
                if line_str == "" and len(buffer) > 2:
                    game_text = "\n".join(buffer) + "\n"

                    if not _is_variant(buffer):
                        f.write(game_text)
                        game_count += 1
                        pbar.update(1)

                    buffer = []

            pbar.close()

    print(f"  Saved {game_count} standard games to {output_path}")
    return game_count


def _is_variant(lines: list[str]) -> bool:
    """Returns True if any PGN header indicates a chess variant."""
    for line in lines:
        if line.startswith("[Variant"):
            variant = line.split('"')[1] if '"' in line else ""
            if variant in EXCLUDED_VARIANTS or variant not in ("Standard", ""):
                return True
    return False
