#!/bin/bash
# End-to-end bot training pipeline.
#
# Usage:
#   ./scripts/train_bot.sh <platform> <username> [display_name] [elo_blitz]
#
# Examples:
#   ./scripts/train_bot.sh lichess DrNykterstein "Magnus Carlsen" 2882
#   ./scripts/train_bot.sh chesscom hikaru "Hikaru Nakamura" 3200
#   ./scripts/train_bot.sh lichess myusername "My Clone"

set -e

PLATFORM=${1:?"Usage: $0 <platform> <username> [display_name] [elo_blitz]"}
USERNAME=${2:?"Usage: $0 <platform> <username> [display_name] [elo_blitz]"}
DISPLAY_NAME=${3:-$USERNAME}
ELO_BLITZ=${4:-1500}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "========================================"
echo "  Chess Bot Trainer"
echo "  Player : $USERNAME @ $PLATFORM"
echo "  Name   : $DISPLAY_NAME"
echo "  ELO    : ~$ELO_BLITZ blitz"
echo "========================================"
echo ""

echo "--- Step 1/6: Download games ---"
python pipeline/01_download.py \
  --platform "$PLATFORM" \
  --username "$USERNAME"

echo ""
echo "--- Step 2/6: Parse PGN ---"
python pipeline/02_parse.py \
  --platform "$PLATFORM" \
  --username "$USERNAME"

echo ""
echo "--- Step 3/6: Encode positions ---"
python pipeline/03_encode.py \
  --platform "$PLATFORM" \
  --username "$USERNAME"

echo ""
echo "--- Step 4/6: Train model ---"
python pipeline/04_train.py \
  --platform "$PLATFORM" \
  --username "$USERNAME"

echo ""
echo "--- Step 5/6: Export to TF.js ---"
python pipeline/05_export.py \
  --platform "$PLATFORM" \
  --username "$USERNAME"

echo ""
echo "--- Step 6/6: Package bundle ---"
python pipeline/06_package.py \
  --platform "$PLATFORM" \
  --username "$USERNAME" \
  --display-name "$DISPLAY_NAME" \
  --elo-blitz "$ELO_BLITZ"

echo ""
echo "========================================"
SLUG="${USERNAME,,}_${PLATFORM}"
echo "  Bot bundle: data/bots/$SLUG/"
echo "  Copy to app assets to use it."
echo "========================================"
