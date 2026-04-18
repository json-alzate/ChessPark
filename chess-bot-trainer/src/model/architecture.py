"""
Slim ResNet chess policy+value network.
Target: ~2M parameters, <10MB after float16 quantization.

Input:  (8, 8, 20)  — board encoding
Output: [(None, 4096), (None, 1)]  — policy logits, value tanh
"""

import tensorflow as tf
from tensorflow import keras


def residual_block(x, filters: int, name: str):
    shortcut = x
    x = keras.layers.Conv2D(filters, 3, padding="same", use_bias=False, name=f"{name}_c1")(x)
    x = keras.layers.BatchNormalization(name=f"{name}_bn1")(x)
    x = keras.layers.ReLU(name=f"{name}_relu1")(x)
    x = keras.layers.Conv2D(filters, 3, padding="same", use_bias=False, name=f"{name}_c2")(x)
    x = keras.layers.BatchNormalization(name=f"{name}_bn2")(x)
    x = keras.layers.Add(name=f"{name}_add")([shortcut, x])
    x = keras.layers.ReLU(name=f"{name}_relu2")(x)
    return x


def build_model(filters: int = 64, num_blocks: int = 6) -> keras.Model:
    """
    Builds the policy+value network.

    Args:
        filters: Number of convolutional filters per layer.
        num_blocks: Number of residual blocks (more = stronger but larger).
    """
    inputs = keras.Input(shape=(8, 8, 20), name="board_input")

    # Input stem
    x = keras.layers.Conv2D(filters, 3, padding="same", use_bias=False, name="stem_conv")(inputs)
    x = keras.layers.BatchNormalization(name="stem_bn")(x)
    x = keras.layers.ReLU(name="stem_relu")(x)

    # Residual tower
    for i in range(num_blocks):
        x = residual_block(x, filters, name=f"res{i}")

    # --- Policy head ---
    p = keras.layers.Conv2D(2, 1, padding="same", use_bias=False, name="policy_conv")(x)
    p = keras.layers.BatchNormalization(name="policy_bn")(p)
    p = keras.layers.ReLU(name="policy_relu")(p)
    p = keras.layers.Flatten(name="policy_flatten")(p)
    policy_output = keras.layers.Dense(4096, name="policy_logits")(p)

    # --- Value head ---
    v = keras.layers.Conv2D(1, 1, padding="same", use_bias=False, name="value_conv")(x)
    v = keras.layers.BatchNormalization(name="value_bn")(v)
    v = keras.layers.ReLU(name="value_relu")(v)
    v = keras.layers.Flatten(name="value_flatten")(v)
    v = keras.layers.Dense(64, activation="relu", name="value_dense")(v)
    value_output = keras.layers.Dense(1, activation="tanh", name="value_output")(v)

    model = keras.Model(inputs=inputs, outputs=[policy_output, value_output], name="chess_bot")
    return model


def compile_model(model: keras.Model, learning_rate: float = 0.001) -> None:
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss={
            "policy_logits": keras.losses.CategoricalCrossentropy(from_logits=True),
            "value_output": keras.losses.MeanSquaredError(),
        },
        loss_weights={
            "policy_logits": 1.0,
            "value_output": 0.01,
        },
        metrics={
            "policy_logits": [keras.metrics.CategoricalAccuracy(name="top1_accuracy")],
        },
    )
