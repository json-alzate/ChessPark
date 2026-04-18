"""
Generates bot_profile.json metadata from training results.
"""

import json
from datetime import datetime, timezone
from pathlib import Path


PIPELINE_VERSION = "1.0.0"


def generate_profile(
    slug: str,
    platform: str,
    username: str,
    display_name: str,
    estimated_elo: dict,
    games_used: int,
    top_move_accuracy: float,
    model_path: str,
    model_size_bytes: int,
    opening_book_positions: int,
    opening_book_max_depth: int,
    description: str = "",
) -> dict:
    return {
        "slug": slug,
        "displayName": display_name,
        "platform": platform,
        "username": username,
        "description": description,
        "estimatedElo": estimated_elo,
        "trainingStats": {
            "gamesUsed": games_used,
            "trainedAt": datetime.now(timezone.utc).isoformat(),
            "pipelineVersion": PIPELINE_VERSION,
            "topMoveAccuracy": round(top_move_accuracy, 4),
        },
        "model": {
            "path": model_path,
            "inputShape": [8, 8, 20],
            "outputShape": 4096,
            "sizeBytes": model_size_bytes,
            "quantized": "float16",
        },
        "openingBook": {
            "path": "opening_book.json",
            "positions": opening_book_positions,
            "maxDepth": opening_book_max_depth,
        },
    }


def save_profile(profile: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)
    print(f"  Profile saved: {output_path}")
