"""
Converts a TensorFlow SavedModel to TF.js graph model format.
Requires tensorflowjs to be installed: pip install tensorflowjs
"""

import subprocess
import shutil
from pathlib import Path


def convert_to_tfjs(
    saved_model_path: Path,
    output_path: Path,
    quantize: bool = True,
    shard_size_mb: int = 5,
) -> None:
    """
    Converts a TF SavedModel to TF.js graph model.

    Args:
        saved_model_path: Directory containing the TF SavedModel.
        output_path: Destination directory for TF.js model files.
        quantize: Apply float16 quantization to halve model size.
        shard_size_mb: Size of each weight shard file in MB.
    """
    output_path.mkdir(parents=True, exist_ok=True)

    cmd = [
        "tensorflowjs_converter",
        "--input_format=tf_saved_model",
        "--output_format=tfjs_graph_model",
        f"--weight_shard_size_bytes={shard_size_mb * 1024 * 1024}",
        str(saved_model_path),
        str(output_path),
    ]

    if quantize:
        cmd.insert(-2, "--quantize_float16=*")

    print(f"  Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"TF.js conversion failed:\n{result.stderr}")

    # Verify output
    model_json = output_path / "model.json"
    if not model_json.exists():
        raise FileNotFoundError(f"Conversion completed but model.json not found in {output_path}")

    shard_files = list(output_path.glob("group*.bin"))
    total_mb = sum(f.stat().st_size for f in shard_files) / (1024 * 1024)
    print(f"  TF.js model: {len(shard_files)} shard(s), {total_mb:.1f} MB total")
