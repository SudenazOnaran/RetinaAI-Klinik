"""
Egitilmis multitask checkpoint ile fundus goruntusunden Gemini /predict ile uyumlu JSON.

Ornek:
  cd retina_ai/services/ai
  python training/predict_like_gemini_mvp.py --weights training_out/multitask_mvp.pt --image path/to/fundus.png
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from local_multitask_inference import predict_image_path  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", type=Path, required=True)
    ap.add_argument("--image", type=Path, required=True)
    args = ap.parse_args()

    out = predict_image_path(args.image, weights_path=args.weights)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
