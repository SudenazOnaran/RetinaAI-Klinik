"""
app.py ile ayni DR modeli (models/model.pth veya model.pt, DenseNet121).
Gemini tum API anahtarlari kotada / kullanilamaz oldugunda tam gemini-şekilli JSON uretir.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

_BASE = Path(__file__).resolve().parent
_TRAIN = _BASE / "training"
if str(_TRAIN) not in sys.path:
    sys.path.insert(0, str(_TRAIN))

from dr_gradcam_heatmap import (  # noqa: E402
    _DEVICE,
    _generate_gradcam_plus_plus,
    _load_dr_model,
    resolve_densenet_dr_weights_path,
)
from fundus_assessment_normalize import fundus_assessment_from_boolean_map  # noqa: E402
from fundus_constants import DR_GRADE_LABELS_TR, FUNDUS_FINDING_KEYS  # noqa: E402
from gemini_like_narrative_tr import (  # noqa: E402
    build_clinical_decision_rich_tr,
    build_clinical_reasoning_tr,
    build_odir_results_dme,
    build_uncertainty_note_tr,
    english_dr_label,
)


def predict_densenet_gemini_shaped(pil: Image.Image) -> dict | None:
    weights_path = resolve_densenet_dr_weights_path()
    model, tfm = _load_dr_model()
    if model is None or tfm is None:
        return None
    try:
        model_tag = (
            os.path.relpath(weights_path, str(_BASE))
            if weights_path
            else "models/model.pth"
        )
    except ValueError:
        model_tag = os.path.basename(weights_path) if weights_path else "densenet121"

    rgb = pil.convert("RGB")
    original_np = np.array(rgb)
    t = tfm(rgb).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        logits = model(t)
        probs = torch.softmax(logits, dim=1)[0]
        idx = int(torch.argmax(probs).item())
        conf = float(probs[idx].item())
    conf = max(0.0, min(0.95, conf))

    t_grad = tfm(rgb).unsqueeze(0).to(_DEVICE)
    heatmap_plus: str | None = None
    heatmap_method: str | None = None
    try:
        b64 = _generate_gradcam_plus_plus(model, t_grad, idx, original_np)
        if b64:
            heatmap_plus = f"data:image/png;base64,{b64}"
            heatmap_method = "dr_gradcam_densenet121"
    except Exception:
        pass

    findings: dict[str, bool] = {k: False for k in FUNDUS_FINDING_KEYS}
    dme_suspected = False
    fundus_assessment = fundus_assessment_from_boolean_map(
        findings, dme_suspected=dme_suspected, dr_idx=idx
    )
    clinical_reasoning = (
        build_clinical_reasoning_tr(idx, findings, dme_suspected)
        + f" Not: Bu istekte Gemini kullanilamadi; DR evresi yerel DenseNet ({model_tag}) ile uretildi."
    )
    clinical_decision = build_clinical_decision_rich_tr(idx, findings, 0.0)
    pv = (os.environ.get("GEMINI_PROMPT_VERSION") or "0").strip() or "0"
    inference_meta: dict = {
        "backend": "pytorch_densenet121",
        "model": model_tag.replace("\\", "/"),
        "promptVersion": pv,
        "note": "Gemini kotasi / anahtarlar bu istekte kullanilamadi; app.py DR modeli.",
    }
    if heatmap_method:
        inference_meta["heatmapMethod"] = heatmap_method

    return {
        "success": True,
        "drGrade": idx,
        "pytorch": {
            "label": DR_GRADE_LABELS_TR[idx],
            "confidence": conf,
            "rawConfidence": conf,
            "temperature": None,
        },
        "odir": {"results": build_odir_results_dme(False, 0.0)},
        "fundusFindings": findings,
        "fundusAssessment": fundus_assessment,
        "drLabel": english_dr_label(idx),
        "clinicalReasoning": clinical_reasoning[:8000],
        "clinicalDecision": clinical_decision,
        "dmeSuspected": False,
        "dmeConfidence": 0.0,
        "uncertaintyNote": build_uncertainty_note_tr(),
        "heatmapPlus": heatmap_plus,
        "uncertainty": None,
        "ood": None,
        "localization": None,
        "inference": inference_meta,
    }
