# =========================
# app.py
# =========================

import io
import base64
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import random

# =========================
# Flask setup
# =========================
app = Flask(__name__)
CORS(app)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Device:", DEVICE)

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

# =========================
# GRAD-CAM
# =========================
def generate_gradcam(img_tensor, class_idx, original_np):
    gradients = []

    def hook(grad):
        gradients.append(grad)

    img_tensor = img_tensor.clone()
    img_tensor.requires_grad_(True)
    features = pt_model.features(img_tensor)
    features.register_hook(hook)

    out = F.relu(features)
    out = F.adaptive_avg_pool2d(out, (1,1))
    out = out.view(1, -1)
    logits = pt_model.classifier(out)

    score = logits[0, class_idx]
    pt_model.zero_grad()
    score.backward()

    grads = gradients[0]
    weights = torch.mean(grads, dim=(2,3), keepdim=True)
    cam = torch.sum(weights * features, dim=1).squeeze()
    cam = F.relu(cam)
    cam /= cam.max()

    heatmap = cam.detach().cpu().numpy()
    heatmap = cv2.resize(heatmap, (224,224))
    heatmap = np.uint8(255*heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    original = cv2.resize(original_np, (224,224))
    overlay = cv2.addWeighted(original, 0.6, heatmap, 0.4, 0)

    _, buffer = cv2.imencode(".png", overlay)
    return base64.b64encode(buffer).decode()

# =========================
# Flask API
# =========================
@app.route("/predict", methods=["POST"])
def predict():
    print(">>> PREDICT ÇAĞRILDI <<<")
    file = request.files["image"]
    image = Image.open(io.BytesIO(file.read())).convert("RGB")
    
    # ---- PyTorch DR ----
    pt_tensor = pt_transform(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        out = pt_model(pt_tensor)
        probs = torch.softmax(out, dim=1)
        idx = probs.argmax().item()
        dr_conf = float(probs[0, idx])

    heatmap = generate_gradcam(pt_tensor, idx, np.array(image))

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
            "label": "Kararsız",
            "confidence": float(np.max(outputs))
        })

    return jsonify({
        "success": True,
        "pytorch": {
            "label": PT_CLASS_NAMES[idx],
            "confidence": dr_conf
        },
        "odir": {
            "results": odir_results
        },
        "heatmap": f"data:image/png;base64,{heatmap}"
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)
