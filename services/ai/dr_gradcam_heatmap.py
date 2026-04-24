# Yerel DR modeli (model.pth / model.pt) ile Grad-CAM++ — Gemini cevabiyla birlikte istege bagli gorsellestirme.
# app.py ile ayni DenseNet mimarisi; app.py'ye import etmez (cift yukleme yok).

from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torchvision import models, transforms

_AI_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_DIR = os.path.join(_AI_SERVICE_DIR, "models")
_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# CPU'da oneDNN/MKLDNN bazi Linux kurulumlarinda conv2d sirasinda
# "RuntimeError: could not create a primitive" verebilir. Varsayilan: kapali.
# Performans icin sorun yoksa TORCH_MKLDNN=1 ile acilabilir.
if not torch.cuda.is_available():
    _mk = (os.environ.get("TORCH_MKLDNN") or "").strip().lower()
    if _mk not in ("1", "true", "yes", "on"):
        torch.backends.mkldnn.enabled = False


def resolve_densenet_dr_weights_path() -> str | None:
    """
    DenseNet121 DR agirlik dosyasi (app.py ile ayni kaynak).
    Oncelik: DR_DENSENET_WEIGHTS veya DENSENET_DR_WEIGHTS (mutlak veya services/ai veya models/ goreli),
    sonra models/model.pth, sonra models/model.pt.
    """
    for env_name in ("DR_DENSENET_WEIGHTS", "DENSENET_DR_WEIGHTS"):
        raw = (os.environ.get(env_name) or "").strip()
        if not raw:
            continue
        p = Path(raw.replace("/", os.sep))
        candidates = [p] if p.is_absolute() else [Path(_MODEL_DIR) / p, Path(_AI_SERVICE_DIR) / p]
        for c in candidates:
            try:
                rp = c.resolve()
            except OSError:
                continue
            if rp.is_file():
                return str(rp)
    for name in ("model.pth", "model.pt"):
        p = Path(_MODEL_DIR) / name
        if p.is_file():
            return str(p.resolve())
    return None


def dr_heatmap_enabled() -> bool:
    """
    Varsayilan: agirlik dosyasi varsa Grad-CAM acik.
    GEMINI_DR_HEATMAP=0/false ile kapat; 1/true ile ac (model yoksa yine uretilemez).
    """
    v = (os.environ.get("GEMINI_DR_HEATMAP") or "").strip().lower()
    if v in ("0", "false", "no", "off"):
        return False
    if v in ("1", "true", "yes", "on"):
        return True
    return resolve_densenet_dr_weights_path() is not None


_cached_model: nn.Module | None = None
_cached_transform: transforms.Compose | None = None
_cached_weights_path: str | None = None


def _load_dr_model() -> tuple[nn.Module | None, transforms.Compose | None]:
    global _cached_model, _cached_transform, _cached_weights_path
    path = resolve_densenet_dr_weights_path()
    if path is None:
        return None, None
    if (
        _cached_model is not None
        and _cached_transform is not None
        and _cached_weights_path == path
    ):
        return _cached_model, _cached_transform
    m = models.densenet121(weights=None)
    m.classifier = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(m.classifier.in_features, 5),
    )
    m.load_state_dict(torch.load(path, map_location=_DEVICE))
    m.eval()
    m.to(_DEVICE)
    tfm = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )
    _cached_model, _cached_transform = m, tfm
    _cached_weights_path = path
    return m, tfm


def _encode_cam_overlay(cam_tensor: torch.Tensor, original_np: np.ndarray) -> str:
    cam = F.relu(cam_tensor)
    cam_max = torch.max(cam)
    if cam_max.item() > 0:
        cam = cam / cam_max
    heatmap = cam.detach().cpu().numpy()
    heatmap = cv2.resize(heatmap, (224, 224))
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    original = cv2.resize(original_np, (224, 224))
    overlay = cv2.addWeighted(original, 0.6, heatmap, 0.4, 0)
    _, buffer = cv2.imencode(".png", overlay)
    return base64.b64encode(buffer).decode()


def _generate_gradcam_plus_plus(
    pt_model: nn.Module,
    img_tensor: torch.Tensor,
    class_idx: int,
    original_np: np.ndarray,
) -> str:
    gradients: list[torch.Tensor] = []

    def hook(grad: torch.Tensor) -> None:
        gradients.append(grad)

    img_tensor = img_tensor.clone()
    img_tensor.requires_grad_(True)
    features = pt_model.features(img_tensor)
    features.register_hook(hook)

    out = F.relu(features)
    out = F.adaptive_avg_pool2d(out, (1, 1))
    out = out.view(1, -1)
    logits = pt_model.classifier(out)

    score = logits[0, class_idx]
    pt_model.zero_grad()
    score.backward()

    grads = gradients[0]
    grads_power_2 = grads.pow(2)
    grads_power_3 = grads.pow(3)

    sum_activations = torch.sum(features, dim=(2, 3), keepdim=True)
    epsilon = 1e-8
    alpha_denom = (2.0 * grads_power_2) + (sum_activations * grads_power_3)
    alpha_denom = torch.where(
        alpha_denom != 0.0, alpha_denom, torch.ones_like(alpha_denom)
    )
    alphas = grads_power_2 / (alpha_denom + epsilon)

    positive_gradients = F.relu(grads)
    weights = torch.sum(alphas * positive_gradients, dim=(2, 3), keepdim=True)
    cam = torch.sum(weights * features, dim=1).squeeze()
    return _encode_cam_overlay(cam, original_np)


def try_dr_gradcam_data_uri(
    pil: Image.Image,
    class_idx: int | None = None,
) -> tuple[Optional[str], int]:
    """
    class_idx: DR sinifi 0-4; None ise modelin argmax sinifi kullanilir.
    Donus: (base64 png veya None, kullanilan sinif indeksi veya -1)
    """
    model, tfm = _load_dr_model()
    if model is None or tfm is None:
        return None, -1
    rgb = pil.convert("RGB")
    original_np = np.array(rgb)
    t = tfm(rgb).unsqueeze(0).to(_DEVICE)

    idx: int
    if class_idx is None:
        with torch.no_grad():
            logits = model(t)
            idx = int(torch.argmax(logits, dim=1).item())
    else:
        idx = max(0, min(4, int(class_idx)))

    t_grad = tfm(rgb).unsqueeze(0).to(_DEVICE)
    try:
        b64 = _generate_gradcam_plus_plus(model, t_grad, idx, original_np)
        return b64, idx
    except Exception:
        return None, -1
