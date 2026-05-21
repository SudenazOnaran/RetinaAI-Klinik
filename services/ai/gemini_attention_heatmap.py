# Gemini attention_regions (normalize 0-1 koordinatlar) -> yerel Gaussian heatmap overlay.
# OCT / FFA icin; fundus Grad-CAM (dr_gradcam_heatmap.py) ile karistirilmaz.

from __future__ import annotations

import base64
import os
from typing import Any

import cv2
import numpy as np
from PIL import Image

_DEFAULT_MAX_OUTPUT_SIDE = 768


def gemini_attention_heatmap_enabled() -> bool:
    """Varsayilan: acik. GEMINI_ATTENTION_HEATMAP=0 ile kapat."""
    v = (os.environ.get("GEMINI_ATTENTION_HEATMAP") or "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _coerce_region_item(item: object) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    d = item
    try:
        x = _clamp01(float(d.get("x")))
        y = _clamp01(float(d.get("y")))
    except (TypeError, ValueError):
        return None
    weight_raw = d.get("weight", d.get("agirlik", d.get("importance", 0.7)))
    try:
        weight = _clamp01(float(weight_raw))
    except (TypeError, ValueError):
        weight = 0.7
    if weight <= 0:
        return None
    radius_raw = d.get("radius", d.get("yaricap", d.get("yaricap_norm", 0.1)))
    try:
        radius = _clamp01(float(radius_raw))
    except (TypeError, ValueError):
        radius = 0.1
    radius = max(0.03, min(0.35, radius))
    label = str(d.get("label", d.get("etiket", d.get("finding", ""))) or "").strip()[:200]
    return {"x": x, "y": y, "weight": weight, "radius": radius, "label": label}


def parse_attention_regions(raw: object) -> list[dict[str, Any]]:
    """
    Gemini JSON: attention_regions veya dikkat_bolgeleri listesi.
    Her oge: x, y (0-1), weight/agirlik (0-1), radius/yaricap (0-1, opsiyonel).
    """
    if raw is None:
        return []
    if isinstance(raw, dict):
        for key in ("regions", "bolgeler", "points", "items"):
            inner = raw.get(key)
            if isinstance(inner, list):
                raw = inner
                break
        else:
            return []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw[:24]:
        parsed = _coerce_region_item(item)
        if parsed:
            out.append(parsed)
    return out


def _resize_rgb_for_output(rgb: np.ndarray, max_side: int) -> np.ndarray:
    h, w = rgb.shape[:2]
    m = max(h, w)
    if m <= max_side:
        return rgb
    scale = max_side / m
    nw, nh = int(w * scale), int(h * scale)
    return cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA)


def _gaussian_blob(
    h: int,
    w: int,
    cx: float,
    cy: float,
    sigma: float,
    weight: float,
    acc: np.ndarray,
) -> None:
    if sigma <= 0:
        return
    radius_px = int(max(3, sigma * 3))
    ix = int(round(cx))
    iy = int(round(cy))
    x0 = max(0, ix - radius_px)
    x1 = min(w, ix + radius_px + 1)
    y0 = max(0, iy - radius_px)
    y1 = min(h, iy + radius_px + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    g = np.exp(-(((xx - cx) ** 2) + ((yy - cy) ** 2)) / (2.0 * sigma**2))
    acc[y0:y1, x0:x1] += weight * g


def render_attention_heatmap_png_b64(
    pil: Image.Image,
    regions: list[dict[str, Any]],
    *,
    max_output_side: int = _DEFAULT_MAX_OUTPUT_SIDE,
) -> str | None:
    """Orijinal goruntu uzerine JET overlay; base64 PNG (data URI prefix haric)."""
    if not regions:
        return None
    rgb = np.array(pil.convert("RGB"))
    rgb = _resize_rgb_for_output(rgb, max(256, min(2048, int(max_output_side))))
    h, w = rgb.shape[:2]
    acc = np.zeros((h, w), dtype=np.float32)
    ref = float(min(h, w))
    for r in regions:
        cx = _clamp01(r["x"]) * (w - 1)
        cy = _clamp01(r["y"]) * (h - 1)
        weight = _clamp01(r["weight"])
        radius_norm = _clamp01(r.get("radius", 0.1))
        sigma = max(4.0, radius_norm * ref * 0.45)
        _gaussian_blob(h, w, cx, cy, sigma, weight, acc)
    if float(acc.max()) <= 0:
        return None
    acc = acc / float(acc.max())
    heat_uint8 = np.uint8(255 * acc)
    heat_color = cv2.applyColorMap(heat_uint8, cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(rgb, 0.58, heat_color, 0.42, 0)
    ok, buffer = cv2.imencode(".png", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
    if not ok:
        return None
    return base64.b64encode(buffer).decode()


def try_gemini_attention_heatmap_data_uri(
    pil: Image.Image,
    regions: list[dict[str, Any]],
) -> str | None:
    if not gemini_attention_heatmap_enabled():
        return None
    b64 = render_attention_heatmap_png_b64(pil, regions)
    if not b64:
        return None
    return f"data:image/png;base64,{b64}"
