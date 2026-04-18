"""
Downloads games from the Chess.com public API for a given username.
Iterates month-by-month archives. Standard chess only.
"""

import time
from datetime import datetime, date
from pathlib import Path

import requests
from tqdm import tqdm

CHESSCOM_ARCHIVES = "https://api.chess.com/pub/player/{username}/games/archives"
CHESSCOM_MONTH = "https://api.chess.com/pub/player/{username}/games/{year}/{month:02d}"

EXCLUDED_RULES = {"chess960", "kingofthehill", "threecheck", "bughouse", "crazyhouse", "oddschess"}

HEADERS = {
    "User-Agent": "ChessBotTrainer/1.0 (github.com/chesspark)"
}


def download_games(
    username: str,
    output_path: Path,
    max_games: int = 5000,
    since_year: int = 2015,
) -> int:
    """
    Downloads up to max_games standard chess games for username from Chess.com.
    Iterates archives from newest to oldest until max_games is reached.

    Returns the number of games written.
    """
    archives = _get_archives(username)
    if not archives:
        print(f"  No archives found for {username}@chess.com")
        return 0

    # Filter archives by date
    filtered = [a for a in reversed(archives) if _archive_year(a) >= since_year]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    game_count = 0

    with open(output_path, "w", encoding="utf-8") as f:
        pbar = tqdm(desc=f"Downloading {username}@chess.com", unit="games", total=max_games)

        for archive_url in filtered:
            if game_count >= max_games:
                break

            games = _fetch_archive(archive_url)
            for game in games:
                if game_count >= max_games:
                    break

                rules = game.get("rules", "chess")
                if rules in EXCLUDED_RULES:
                    continue

                pgn = game.get("pgn", "").strip()
                if not pgn:
                    continue

                f.write(pgn + "\n\n")
                game_count += 1
                pbar.update(1)

            time.sleep(0.2)  # Respect Chess.com rate limits

        pbar.close()

    print(f"  Saved {game_count} standard games to {output_path}")
    return game_count


def _get_archives(username: str) -> list[str]:
    try:
        resp = requests.get(
            CHESSCOM_ARCHIVES.format(username=username),
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("archives", [])
    except Exception as e:
        print(f"  Failed to fetch archives: {e}")
        return []


def _fetch_archive(url: str) -> list[dict]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.json().get("games", [])
    except Exception as e:
        print(f"  Failed to fetch archive {url}: {e}")
        return []


def _archive_year(url: str) -> int:
    try:
        return int(url.rstrip("/").split("/")[-2])
    except (ValueError, IndexError):
        return 0
