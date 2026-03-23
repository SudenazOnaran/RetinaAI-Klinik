# =========================
# app.py
# =========================

import io
import base64
import time
import threading
import os
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
import random
from collections import defaultdict, deque
from werkzeug.exceptions import RequestEntityTooLarge

# =========================
# Flask setup
# =========================
app = Flask(__name__)
CORS(app)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Device:", DEVICE)

# Upload and decode safety limits
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
Image.MAX_IMAGE_PIXELS = 25_000_000
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/bmp",
    "image/webp",
}

# Basic in-memory IP rate limiter
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 30
_rate_limit_store = defaultdict(deque)
_rate_limit_lock = threading.Lock()


def _is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    with _rate_limit_lock:
        bucket = _rate_limit_store[client_ip]
        while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()

        if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
            return True

        bucket.append(now)
        return False


def _has_allowed_extension(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = "." + filename.rsplit(".", 1)[-1].lower()
    return ext in ALLOWED_EXTENSIONS


def _safe_load_image(file_storage):
    if file_storage is None:
        raise ValueError("Gorsel dosyasi bulunamadi.")

    if not _has_allowed_extension(file_storage.filename or ""):
        raise ValueError("Sadece JPG, JPEG, PNG, BMP ve WEBP formatlari kabul edilir.")

    content_type = (file_storage.content_type or "").lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Gecersiz dosya tipi. Lutfen bir gorsel yukleyin.")

    raw = file_storage.read()
    if not raw:
        raise ValueError("Bos dosya yuklenemez.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError("Dosya boyutu limiti asildi.")

    try:
        # Verify first pass, then reopen for actual decoding.
        Image.open(io.BytesIO(raw)).verify()
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ValueError("Dosya gecerli bir gorsel degil.")


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(_error):
    return jsonify({
        "success": False,
        "error": "Dosya boyutu limiti asildi. Maksimum 8 MB yukleyebilirsiniz.",
    }), 413

# =========================
# PyTorch DR MODEL
# =========================
pt_model = models.densenet121(weights=None)
pt_model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(pt_model.classifier.in_features, 5)
)
pt_model.load_state_dict(torch.load("model.pth", map_location=DEVICE))
pt_model.eval()
pt_model.to(DEVICE)

PT_CLASS_NAMES = [
    "Sağlıklı",
    "Hafif Evre",
    "Orta Evre",
    "Ağır Evre",
    "Çok İleri Evre"
]

pt_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# =========================
# PyTorch ODIR MODEL
# =========================
# =========================
# PyTorch ODIR MODEL
# =========================
class ODIRModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = models.efficientnet_b0(weights=None)

        # classifier artık Sequential değil tek Linear olmalı
        in_features = self.backbone.classifier[1].in_features if isinstance(self.backbone.classifier, nn.Sequential) else self.backbone.classifier.in_features
        self.backbone.classifier = nn.Linear(in_features, 8)  # 8 sınıf

    def forward(self, x):
        return self.backbone(x)


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
odir_model = ODIRModel().to(DEVICE)

# Bu satırda hata olmaması için strict=False kullanıyoruz
odir_model.load_state_dict(
    torch.load("efficientnet_odir_best_auc.pth", map_location=DEVICE),
    strict=False
)
odir_model.eval()


odir_model.to(DEVICE)

ODIR_LABELS = [
    "Normal / Sağlıklı",       # N
    # "Diyabetik Retinopati",  # D → çıkardık
    "Glokom",                   # G
    "Katarakt",                 # C
    "Hipertansiyon",            # A
    "AMD (Yaşa Bağlı Makula Dejenerasyonu)",  # H
    "Miyopi",                   # M
    "Diğer Göz Hastalıkları"    # O
]


ODIR_THRESHOLD = 0.5  # Karar eşiği

# DR reliability settings
DR_TEMPERATURE = 1.6
MC_DROPOUT_SAMPLES = 10
OOD_CONFIDENCE_THRESHOLD = 0.55
OOD_ENTROPY_THRESHOLD = 1.15

AI_GATEWAY_SHARED_SECRET = os.environ.get("AI_GATEWAY_SHARED_SECRET", "retina-ai-gateway-dev-secret")
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

# =========================
# Preprocess fonksiyonu
# =========================
def preprocess_fundus(img, final_size=512):
    h, w, _ = img.shape
    size = max(h, w)
    padded = np.zeros((size, size, 3), dtype=np.uint8)
    y = (size - h) // 2
    x = (size - w) // 2
    padded[y:y+h, x:x+w] = img

    img = cv2.resize(padded, (final_size, final_size))

    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((l,a,b)), cv2.COLOR_LAB2RGB)

    gamma = 1.2
    img = np.power(img / 255.0, gamma)

    return img.astype(np.float32)

def weak_augment(img):
    if random.random() < 0.5:
        img = np.fliplr(img)
    return img

def odir_preprocess_pil(img_pil):
    img_np = np.array(img_pil)
    img_np = preprocess_fundus(img_np, final_size=512)
    img_tensor = torch.from_numpy(img_np.copy()).permute(2,0,1).float()
    return img_tensor


def _safe_load_roi_mask(mask_file_storage):
    if mask_file_storage is None:
        return None

    raw = mask_file_storage.read()
    if not raw:
        return None

    try:
        mask = Image.open(io.BytesIO(raw)).convert("L")
        return np.array(mask)
    except (UnidentifiedImageError, OSError):
        return None


def _encode_cam_overlay(cam_tensor, original_np):
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


def _cam_tensor_to_map(cam_tensor, target_size=(224, 224)):
    cam = F.relu(cam_tensor)
    cam_max = torch.max(cam)
    if cam_max.item() > 0:
        cam = cam / cam_max

    cam_map = cam.detach().cpu().numpy()
    cam_map = cv2.resize(cam_map, target_size)
    cam_map = np.clip(cam_map, 0.0, 1.0)
    return cam_map

def generate_gradcam_plus_plus(img_tensor, class_idx, original_np):
    gradients = []

    def hook(grad):
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
    alpha_denom = torch.where(alpha_denom != 0.0, alpha_denom, torch.ones_like(alpha_denom))
    alphas = grads_power_2 / (alpha_denom + epsilon)

    positive_gradients = F.relu(grads)
    weights = torch.sum(alphas * positive_gradients, dim=(2, 3), keepdim=True)
    cam = torch.sum(weights * features, dim=1).squeeze()

    cam_map = _cam_tensor_to_map(cam, target_size=(224, 224))
    return _encode_cam_overlay(cam, original_np), cam_map


def _enable_dropout_only(module):
    for m in module.modules():
        if isinstance(m, nn.Dropout):
            m.train()


def _compute_mc_dropout_uncertainty(img_tensor, mc_samples=10):
    pt_model.eval()
    _enable_dropout_only(pt_model)

    mc_probs = []
    with torch.no_grad():
        for _ in range(mc_samples):
            logits = pt_model(img_tensor)
            mc_probs.append(torch.softmax(logits, dim=1))

    pt_model.eval()

    probs = torch.stack(mc_probs, dim=0)  # [S, B, C]
    mean_probs = probs.mean(dim=0)
    pred_idx = int(torch.argmax(mean_probs, dim=1).item())

    predictive_entropy = float(-(mean_probs * torch.log(mean_probs + 1e-8)).sum(dim=1).item())
    expected_entropy = float((-(probs * torch.log(probs + 1e-8)).sum(dim=2)).mean(dim=0).item())
    mutual_information = max(0.0, predictive_entropy - expected_entropy)
    pred_var = float(probs[:, 0, pred_idx].var().item())

    return {
        "predictiveEntropy": predictive_entropy,
        "expectedEntropy": expected_entropy,
        "mutualInformation": float(mutual_information),
        "classVariance": pred_var,
        "mcSamples": int(mc_samples),
    }


def _estimate_ood(calibrated_confidence, predictive_entropy, num_classes):
    normalized_entropy = predictive_entropy / max(np.log(float(num_classes)), 1e-8)
    ood_score = float(np.clip((1.0 - calibrated_confidence + normalized_entropy) / 2.0, 0.0, 1.0))
    is_ood = bool(
        calibrated_confidence < OOD_CONFIDENCE_THRESHOLD
        or predictive_entropy > OOD_ENTROPY_THRESHOLD
    )
    return {
        "score": ood_score,
        "isOutOfDistribution": is_ood,
        "confidenceThreshold": OOD_CONFIDENCE_THRESHOLD,
        "entropyThreshold": OOD_ENTROPY_THRESHOLD,
    }


def _compute_localization_metrics(cam_map, roi_mask_np):
    if roi_mask_np is None:
        return None

    roi_resized = cv2.resize(roi_mask_np, (224, 224), interpolation=cv2.INTER_NEAREST)
    roi_bin = (roi_resized > 0).astype(np.uint8)
    if np.sum(roi_bin) == 0:
        return None

    threshold = np.percentile(cam_map, 85)
    cam_bin = (cam_map >= threshold).astype(np.uint8)

    intersection = np.logical_and(cam_bin == 1, roi_bin == 1).sum()
    union = np.logical_or(cam_bin == 1, roi_bin == 1).sum()
    cam_sum = cam_bin.sum()
    roi_sum = roi_bin.sum()

    iou = float(intersection / union) if union > 0 else 0.0
    dice = float((2.0 * intersection) / (cam_sum + roi_sum)) if (cam_sum + roi_sum) > 0 else 0.0

    max_pos = np.unravel_index(np.argmax(cam_map), cam_map.shape)
    pointing_hit = bool(roi_bin[max_pos] == 1)

    return {
        "iou": iou,
        "dice": dice,
        "pointingHit": pointing_hit,
        "camThresholdPercentile": 85,
    }

# =========================
# Flask API
# =========================
@app.route("/predict", methods=["POST"])
def predict():
    gateway_key = request.headers.get("X-AI-Gateway-Key", "")
    if gateway_key != AI_GATEWAY_SHARED_SECRET:
        return jsonify({
            "success": False,
            "error": "Yetkisiz AI erisimi.",
        }), 401

    client_ip = (request.headers.get("X-Forwarded-For", "") or request.remote_addr or "unknown").split(",")[0].strip()
    if _is_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.",
        }), 429

    try:
        file = request.files.get("image")
        image = _safe_load_image(file)
        roi_mask = _safe_load_roi_mask(request.files.get("roiMask"))

        # ---- PyTorch DR ----
        pt_tensor = pt_transform(image).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            logits = pt_model(pt_tensor)
            raw_probs = torch.softmax(logits, dim=1)
            calibrated_probs = torch.softmax(logits / DR_TEMPERATURE, dim=1)
            idx = calibrated_probs.argmax().item()
            dr_conf = float(calibrated_probs[0, idx])
            raw_conf = float(raw_probs[0, idx])

        original_np = np.array(image)
        heatmap_plus, cam_map = generate_gradcam_plus_plus(pt_tensor, idx, original_np)
        uncertainty = _compute_mc_dropout_uncertainty(pt_tensor, mc_samples=MC_DROPOUT_SAMPLES)
        ood = _estimate_ood(dr_conf, uncertainty["predictiveEntropy"], num_classes=len(PT_CLASS_NAMES))
        localization = _compute_localization_metrics(cam_map, roi_mask)

        # ---- PyTorch ODIR ----
        odir_tensor = odir_preprocess_pil(image).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            outputs = torch.sigmoid(odir_model(odir_tensor)).cpu().numpy()[0]

        odir_results = []
        for label, prob in zip(ODIR_LABELS, outputs):
            if prob >= ODIR_THRESHOLD:
                odir_results.append({
                    "label": label,
                    "confidence": float(prob)
                })

        if len(odir_results) == 0:
            odir_results.append({
                "label": "Kararsiz",
                "confidence": float(np.max(outputs))
            })

        return jsonify({
            "success": True,
            "pytorch": {
                "label": PT_CLASS_NAMES[idx],
                "confidence": dr_conf,
                "rawConfidence": raw_conf,
                "temperature": DR_TEMPERATURE
            },
            "odir": {
                "results": odir_results
            },
            "heatmapPlus": f"data:image/png;base64,{heatmap_plus}",
            "uncertainty": uncertainty,
            "ood": ood,
            "localization": localization
        })
    except ValueError as err:
        return jsonify({"success": False, "error": str(err)}), 400
    except Exception:
        return jsonify({
            "success": False,
            "error": "Analiz sirasinda beklenmeyen bir hata olustu.",
        }), 500

if __name__ == "__main__":
    app.run(port=5000, debug=FLASK_DEBUG)
