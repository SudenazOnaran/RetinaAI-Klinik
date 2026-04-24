"""
Egitilmis multitask agirliklari ile PIL goruntusunden Gemini /predict ile uyumlu JSON.
app_gemini.py (USE_LOCAL_MULTITASK_FIRST) ve CLI tarafindan kullanilir.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

BASE_DIR = Path(__file__).resolve().parent
_TRAIN_DIR = BASE_DIR / "training"
if str(_TRAIN_DIR) not in sys.path:
    sys.path.insert(0, str(_TRAIN_DIR))

from fundus_constants import DR_GRADE_LABELS_TR, FUNDUS_FINDING_KEYS  # noqa: E402
from fundus_assessment_normalize import fundus_assessment_from_boolean_map  # noqa: E402
from gemini_like_narrative_tr import (  # noqa: E402
    build_clinical_decision_rich_tr,
    build_clinical_reasoning_tr,
    build_inference_meta_local,
    build_odir_results_dme,
    build_uncertainty_note_tr,
    english_dr_label,
)
from train_multitask_fundus_mvp import MultiTaskFundusModel  # noqa: E402

_MODEL: MultiTaskFundusModel | None = None
_DEVICE: torch.device | None = None
_WEIGHTS_RESOLVED: str | None = None


def _resolve_weights_path(raw: str) -> Path:
    p = Path(raw.strip())
    if not p.is_absolute():
        p = BASE_DIR / p
    return p.resolve()


def _clamp_conf(x: float, hi: float = 0.95) -> float:
    return max(0.0, min(hi, float(x)))


def ensure_model_loaded(weights_path: str | Path | None = None) -> None:
    global _MODEL, _DEVICE, _WEIGHTS_RESOLVED
    raw = weights_path or os.environ.get("LOCAL_MULTITASK_WEIGHTS") or ""
    raw = str(raw).strip()
    if not raw:
        raise FileNotFoundError("LOCAL_MULTITASK_WEIGHTS tanimli degil.")
    path = _resolve_weights_path(raw)
    if not path.is_file():
        raise FileNotFoundError(f"Multitask agirlik dosyasi bulunamadi: {path}")

    if _MODEL is not None and _WEIGHTS_RESOLVED == str(path):
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ck = torch.load(path, map_location=device)
    model = MultiTaskFundusModel()
    model.load_state_dict(ck["state_dict"])
    model.to(device)
    model.eval()

    _MODEL = model
    _DEVICE = device
    _WEIGHTS_RESOLVED = str(path)


def _forward_pil(pil_image: Image.Image) -> tuple[int, float, torch.Tensor, float]:
    if _MODEL is None or _DEVICE is None:
        raise RuntimeError("Model yuklenmedi; ensure_model_loaded() cagirin.")
    tfm = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
            ),
        ]
    )
    img = pil_image.convert("RGB")
    x = tfm(img).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        dr_l, fu_l, dm_l = _MODEL(x)
        dr_probs = torch.softmax(dr_l, dim=1)[0]
        dr_idx = int(dr_probs.argmax().item())
        dr_conf = float(dr_probs[dr_idx].item())
        fu_probs = torch.sigmoid(fu_l[0])
        dme_prob = float(torch.sigmoid(dm_l[0, 0]).item())
    return dr_idx, dr_conf, fu_probs.cpu(), dme_prob


def _maybe_heatmap(pil_image: Image.Image, class_idx: int) -> tuple[str | None, str | None]:
    try:
        from dr_gradcam_heatmap import dr_heatmap_enabled, try_dr_gradcam_data_uri

        if not dr_heatmap_enabled():
            return None, None

        b64, _cam_idx = try_dr_gradcam_data_uri(pil_image, class_idx=class_idx)
        if not b64:
            b64, _cam_idx = try_dr_gradcam_data_uri(pil_image, class_idx=None)
        if b64:
            return f"data:image/png;base64,{b64}", "dr_gradcam_local"
    except Exception:
        pass
    return None, None


def build_gemini_shaped_response(
    pil_image: Image.Image,
    dr_idx: int,
    dr_conf: float,
    fundus_probs: torch.Tensor,
    dme_prob: float,
    weights_display_name: str | None = None,
) -> dict:
    findings_bool = {
        k: float(fundus_probs[i]) >= 0.5 for i, k in enumerate(FUNDUS_FINDING_KEYS)
    }
    dme_suspected = dme_prob >= 0.5
    label_tr = DR_GRADE_LABELS_TR[dr_idx]
    clinical_decision = build_clinical_decision_rich_tr(dr_idx, findings_bool, dme_prob)
    heatmap_plus, heatmap_method = _maybe_heatmap(pil_image, dr_idx)

    meta = build_inference_meta_local(
        weights_display_name or (_WEIGHTS_RESOLVED or "multitask_mvp.pt")
    )
    if heatmap_method:
        meta["heatmapMethod"] = heatmap_method

    fundus_assessment = fundus_assessment_from_boolean_map(
        findings_bool, dme_suspected=dme_suspected, dr_idx=dr_idx
    )
    return {
        "success": True,
        "drGrade": dr_idx,
        "pytorch": {
            "label": label_tr,
            "confidence": _clamp_conf(dr_conf),
            "rawConfidence": _clamp_conf(dr_conf),
            "temperature": None,
        },
        "odir": {"results": build_odir_results_dme(dme_suspected, dme_prob)},
        "fundusFindings": findings_bool,
        "fundusAssessment": fundus_assessment,
        "drLabel": english_dr_label(dr_idx),
        "clinicalReasoning": build_clinical_reasoning_tr(
            dr_idx, findings_bool, dme_suspected
        ),
        "clinicalDecision": clinical_decision,
        "dmeSuspected": dme_suspected,
        "dmeConfidence": _clamp_conf(dme_prob, 0.95),
        "uncertaintyNote": build_uncertainty_note_tr(),
        "heatmapPlus": heatmap_plus,
        "uncertainty": None,
        "ood": None,
        "localization": None,
        "inference": meta,
    }


def predict_pil_gemini_shaped(
    pil_image: Image.Image,
    weights_path: str | Path | None = None,
) -> dict:
    ensure_model_loaded(weights_path)
    dr_idx, dr_conf, fu_probs, dme_prob = _forward_pil(pil_image)
    return build_gemini_shaped_response(
        pil_image, dr_idx, dr_conf, fu_probs, dme_prob
    )


def predict_image_path(image_path: Path, weights_path: str | Path | None = None) -> dict:
    pil = Image.open(image_path)
    try:
        return predict_pil_gemini_shaped(pil, weights_path=weights_path)
    finally:
        pil.close()
