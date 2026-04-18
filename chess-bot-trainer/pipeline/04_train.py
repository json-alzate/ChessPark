#!/usr/bin/env python3
"""
Step 4: Train the neural network on encoded positions.

Usage:
  python pipeline/04_train.py --username DrNykterstein --platform lichess
  python pipeline/04_train.py --username DrNykterstein --platform lichess --finetune  # incremental
"""

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.encoder.dataset_builder import load_dataset
from src.model.architecture import build_model, compile_model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--platform", choices=["lichess", "chesscom"], required=True)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--filters", type=int, default=64)
    parser.add_argument("--blocks", type=int, default=6)
    parser.add_argument("--val-split", type=float, default=0.1)
    parser.add_argument("--finetune", action="store_true", help="Load existing model and fine-tune")
    args = parser.parse_args()

    import tensorflow as tf

    slug = f"{args.username.lower()}_{args.platform}"
    encoded_dir = Path("data/encoded") / slug
    model_dir = Path("data/saved_models") / slug

    if not (encoded_dir / "X.npy").exists():
        print(f"Error: Encoded data not found. Run 03_encode.py first.")
        sys.exit(1)

    print(f"\n=== Training model for {slug} ===")

    X, y_policy, y_value = load_dataset(encoded_dir)
    print(f"  Loaded {len(X):,} positions")

    # Build or load model
    if args.finetune and model_dir.exists():
        print("  Fine-tuning from existing checkpoint...")
        model = tf.keras.models.load_model(model_dir)
        # Reduce LR for fine-tuning
        compile_model(model, learning_rate=0.0001)
        epochs = min(args.epochs, 5)
    else:
        model = build_model(filters=args.filters, num_blocks=args.blocks)
        compile_model(model, learning_rate=0.001)
        epochs = args.epochs
        model.summary()

    # Callbacks
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(model_dir / "checkpoint"),
            save_best_only=True,
            monitor="val_policy_logits_top1_accuracy",
            mode="max",
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-5,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_policy_logits_top1_accuracy",
            patience=6,
            restore_best_weights=True,
            verbose=1,
        ),
    ]

    history = model.fit(
        X,
        {"policy_logits": y_policy, "value_output": y_value},
        epochs=epochs,
        batch_size=args.batch_size,
        validation_split=args.val_split,
        callbacks=callbacks,
        verbose=1,
    )

    # Save final model
    model_dir.mkdir(parents=True, exist_ok=True)
    model.save(model_dir)
    print(f"\n  Model saved to {model_dir}")

    # Report best accuracy
    val_acc = max(history.history.get("val_policy_logits_top1_accuracy", [0]))
    print(f"  Best validation top-1 accuracy: {val_acc:.4f} ({val_acc*100:.1f}%)")

    print(f"\nNext: python pipeline/05_export.py --username {args.username} --platform {args.platform}")


if __name__ == "__main__":
    main()
