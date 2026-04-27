# =========================
# app_gemini.py — Gemini API ile /predict (app.py degismez)
# Opsiyonel: GEMINI_DR_HEATMAP + services/ai/models/model.pth veya model.pt ile yerel Grad-CAM++ (dr_gradcam_heatmap.py)
# Calistirma: pip install google-genai  sonra  python app_gemini.py
# Ortam: .env, .env.example (yalnizca eksik anahtarlari tamamlar), .env.local (override)
# Gercek anahtarlari tercihen .env.local'e koyun; .env.example repoda placeholder kalmali.
# Opsiyonel: GEMINI_MODEL, GEMINI_MAX_IMAGE_SIDE (varsayilan 384; kotayi yormamak icin),
#   AI_GEMINI_PORT (varsayilan 5001), AI_CORS_*, AI_RATE_LIMIT_*, FLASK_DEBUG
# Yerel multitask (Gemini ile ayni JSON sekli): USE_LOCAL_MULTITASK_FIRST=1 + LOCAL_MULTITASK_WEIGHTS=yol.pt
#   Varsayilan: kapali — model yokken sadece Gemini. Veri seti web kayitlari ile buyur (ikinci plan).
#   GEMINI_API_KEY bu durumda istege bagli; yedek olarak Gemini kullanilacaksa anahtar tanimlayin.
# =========================

import io
import json
import os
from pathlib import Path
import random
import threading
import time
import traceback
from collections import defaultdict, deque

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from fundus_assessment_normalize import normalize_fundus_assessment
from structured_error_log import log_structured_error, resolve_request_id

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=False)
# Ornek sablon; .env / .env.local'de yoksa buradan doldurulur (yerel deneme).
load_dotenv(os.path.join(BASE_DIR, ".env.example"), override=False)
load_dotenv(os.path.join(BASE_DIR, ".env.local"), override=True)

# Varsayilan: 2.5-flash (cok modlu; cogu projede 2.0-flash'tan ayri ucretsiz kota)
GEMINI_MODEL = (os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip() or "gemini-2.5-flash"
# Kucuk kenar = daha az goruntu tokeni; ucretsiz kotada onemli (varsayilan 384)
GEMINI_MAX_IMAGE_SIDE = max(256, min(1024, int(os.environ.get("GEMINI_MAX_IMAGE_SIDE", "384"))))

USE_LOCAL_MULTITASK_FIRST = os.environ.get("USE_LOCAL_MULTITASK_FIRST", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)
LOCAL_MULTITASK_WEIGHTS_RAW = (os.environ.get("LOCAL_MULTITASK_WEIGHTS") or "").strip()


def _local_multitask_weights_path() -> str | None:
    if not LOCAL_MULTITASK_WEIGHTS_RAW:
        return None
    p = Path(LOCAL_MULTITASK_WEIGHTS_RAW)
    if not p.is_absolute():
        p = Path(BASE_DIR) / p
    rp = p.resolve()
    return str(rp) if rp.is_file() else None


def _gemini_api_key_list() -> list[str]:
    """Birden fazla anahtar: kota dolunca sirayla dener. GEMINI_API_KEYS=a,b veya GEMINI_API_KEY_2."""
    raw = (os.environ.get("GEMINI_API_KEYS") or "").strip()
    keys: list[str] = []
    if raw:
        for part in raw.replace("\n", ",").split(","):
            k = part.strip()
            if k and k not in keys:
                keys.append(k)
        return keys
    for env_name in (
        "GEMINI_API_KEY",
        "GEMINI_API_KEY_2",
        "GEMINI_API_KEY_SECONDARY",
        "GEMINI_API_KEY_BACKUP",
    ):
        k = (os.environ.get(env_name) or "").strip()
        if k and k not in keys:
            keys.append(k)
    return keys


def _densenet_fallback_available() -> bool:
    from dr_gradcam_heatmap import resolve_densenet_dr_weights_path

    return resolve_densenet_dr_weights_path() is not None


def _any_backend_configured() -> bool:
    if _gemini_api_key_list():
        return True
    if USE_LOCAL_MULTITASK_FIRST and _local_multitask_weights_path():
        return True
    if _densenet_fallback_available():
        return True
    return False


class GeminiAllKeysExhausted(RuntimeError):
    """Tum Gemini anahtarlari kota/limit nedeniyle kullanilamadi veya hic anahtar yok."""


if not _any_backend_configured():
    raise RuntimeError(
        "AI arka uc yapilandirmasi yok. Secenekler: (1) GEMINI_API_KEY ve istege bagli "
        "GEMINI_API_KEY_2 / GEMINI_API_KEYS, veya (2) USE_LOCAL_MULTITASK_FIRST=1 + "
        "LOCAL_MULTITASK_WEIGHTS, veya (3) app.py ile ayni DenseNet agirliklari (models/model.pth veya model.pt, veya DR_DENSENET_WEIGHTS)."
    )

AI_GATEWAY_SHARED_SECRET = os.environ.get("AI_GATEWAY_SHARED_SECRET")
if not AI_GATEWAY_SHARED_SECRET:
    raise RuntimeError(
        "AI_GATEWAY_SHARED_SECRET tanimli degil. Guvenlik nedeniyle servis baslatilmadi."
    )
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

# --- Flask ---
def _parse_allowed_cors_origins() -> list[str]:
    raw = os.environ.get("AI_CORS_ALLOWED_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:9002",
        "http://127.0.0.1:9002",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


app = Flask(__name__)
ALLOWED_CORS_ORIGINS = _parse_allowed_cors_origins()
CORS(
    app,
    resources={
        r"/predict": {
            "origins": ALLOWED_CORS_ORIGINS,
            "methods": ["POST", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "X-AI-Gateway-Key",
                "X-Request-Id",
                "x-request-id",
            ],
        },
        r"/predict-oct": {
            "origins": ALLOWED_CORS_ORIGINS,
            "methods": ["POST", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "X-AI-Gateway-Key",
                "X-Request-Id",
                "x-request-id",
            ],
        },
        r"/predict-ffa": {
            "origins": ALLOWED_CORS_ORIGINS,
            "methods": ["POST", "OPTIONS"],
            "allow_headers": [
                "Content-Type",
                "X-AI-Gateway-Key",
                "X-Request-Id",
                "x-request-id",
            ],
        },
    },
)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/bmp",
    "image/webp",
}

RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("AI_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("AI_RATE_LIMIT_MAX_REQUESTS", "30"))
RATE_LIMIT_REDIS_URL = os.environ.get("AI_RATE_LIMIT_REDIS_URL", "").strip()
RATE_LIMIT_REDIS_PREFIX = os.environ.get("AI_RATE_LIMIT_REDIS_PREFIX", "ai:ratelimit")

_RATE_LIMIT_REDIS_SCRIPT = """
local key = KEYS[1]
local window_start = tonumber(ARGV[1])
local now_score = tonumber(ARGV[2])
local member = ARGV[3]
local ttl = tonumber(ARGV[4])
local limit = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 1
end

redis.call('ZADD', key, now_score, member)
redis.call('EXPIRE', key, ttl)
return 0
"""

_rate_limit_backend = "memory"
_rate_limit_redis_client = None
if RATE_LIMIT_REDIS_URL:
    if redis is None:
        print(
            "Rate limiter: redis backend is configured but 'redis' package is missing. "
            "Falling back to memory backend."
        )
    else:
        try:
            _rate_limit_redis_client = redis.Redis.from_url(
                RATE_LIMIT_REDIS_URL,
                decode_responses=True,
                socket_timeout=0.5,
                socket_connect_timeout=0.5,
            )
            _rate_limit_redis_client.ping()
            _rate_limit_backend = "redis"
        except Exception as err:
            print(f"Rate limiter: redis backend unavailable ({err}). Falling back to memory backend.")
            _rate_limit_redis_client = None

_rate_limit_store = defaultdict(deque)
_rate_limit_lock = threading.Lock()
print(f"app_gemini rate limiter backend: {_rate_limit_backend}")

DR_GRADE_LABELS_TR = [
    "Evre 0 (Sağlıklı - No DR)",
    "Evre 1 (Hafif - Mild NPDR)  ",
    "Evre 2 (Orta - Moderate NPDR) ",
    "Evre 3 (Şiddetli - Severe NPDR):",
    "Evre 4 (Proliferatif - PDR)",
]


def _is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    if _rate_limit_backend == "redis" and _rate_limit_redis_client is not None:
        key = f"{RATE_LIMIT_REDIS_PREFIX}:gemini:{client_ip}"
        window_start = now - RATE_LIMIT_WINDOW_SECONDS
        member = f"{now}:{random.randint(1000, 9999)}"
        try:
            limited = _rate_limit_redis_client.eval(
                _RATE_LIMIT_REDIS_SCRIPT,
                1,
                key,
                str(window_start),
                str(now),
                member,
                str(RATE_LIMIT_WINDOW_SECONDS),
                str(RATE_LIMIT_MAX_REQUESTS),
            )
            return bool(int(limited))
        except Exception:
            pass

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
        Image.open(io.BytesIO(raw)).verify()
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ValueError("Dosya gecerli bir gorsel degil.")


def _predict_payload_summary() -> str:
    try:
        pid = (request.form.get("patientId") or "").strip()
        pid_len = len(pid)
    except Exception:
        pid_len = 0
    img = request.files.get("image")
    roi = request.files.get("roiMask")
    return json.dumps(
        {
            "patientIdFieldLen": pid_len,
            "hasImageField": img is not None,
            "imageFilenameLen": len((getattr(img, "filename", None) or "")),
            "hasRoiMaskField": roi is not None,
            "contentLength": request.content_length,
        },
        ensure_ascii=False,
    )


def _safe_predict_payload_summary() -> str:
    try:
        return _predict_payload_summary()
    except Exception:
        return json.dumps({"summary": "unavailable"}, ensure_ascii=False)


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(err):
    request_id = resolve_request_id(request.headers)
    log_structured_error(
        request_id=request_id,
        route=request.path or "/predict",
        action="REQUEST_TOO_LARGE",
        error_message=str(err.description or err)[:500],
        payload_summary=_safe_predict_payload_summary(),
    )
    return jsonify({
        "success": False,
        "error": "Dosya boyutu limiti asildi. Maksimum 8 MB yukleyebilirsiniz.",
        "requestId": request_id,
    }), 413


@app.errorhandler(Exception)
def handle_unhandled_exception(err):
    if isinstance(err, HTTPException):
        return err.get_response()
    request_id = resolve_request_id(request.headers)
    patient_id = None
    try:
        patient_id = (request.form.get("patientId") or "").strip() or None
    except Exception:
        pass
    log_structured_error(
        request_id=request_id,
        route=request.path or "unknown",
        action="UNHANDLED_EXCEPTION",
        error_message=str(err),
        stack=traceback.format_exc(),
        patient_id=patient_id,
        payload_summary=_safe_predict_payload_summary()
        if request.path in ("/predict", "/predict-oct", "/predict-ffa")
        else json.dumps({"path": request.path}, ensure_ascii=False),
    )
    return jsonify({
        "success": False,
        "error": "Sunucu hatasi.",
        "requestId": request_id,
    }), 500


def _resize_pil_for_gemini(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    m = max(w, h)
    if m <= GEMINI_MAX_IMAGE_SIDE:
        return img
    scale = GEMINI_MAX_IMAGE_SIDE / m
    return img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)


def _gemini_error_blob(err: BaseException, depth: int = 0) -> str:
    """APIError.details ve __cause__ zincirindeki kota metnini yakalamak icin."""
    if depth > 6:
        return ""
    chunks: list[str] = [str(err), repr(err)]
    if isinstance(err, genai_errors.APIError):
        status = (getattr(err, "status", None) or "") or ""
        msg = (getattr(err, "message", None) or "") or ""
        chunks.append(status)
        chunks.append(msg)
        details = getattr(err, "details", None)
        if details is not None:
            try:
                chunks.append(json.dumps(details, ensure_ascii=False))
            except (TypeError, ValueError):
                chunks.append(str(details))
    cause = getattr(err, "__cause__", None)
    if cause is not None:
        chunks.append(_gemini_error_blob(cause, depth + 1))
    ctx = getattr(err, "__context__", None)
    if ctx is not None and ctx is not cause:
        chunks.append(_gemini_error_blob(ctx, depth + 1))
    return " ".join(chunks)


def _is_gemini_quota_error(err: Exception) -> bool:
    blob = _gemini_error_blob(err).lower()
    return (
        "resource_exhausted" in blob
        or "quota exceeded" in blob
        or "quotafailure" in blob.replace(".", "")
        or "generate_content_free_tier" in blob.replace(".", "")
        or "generate_requests_per_day" in blob
        or "generaterequestsperday" in blob.replace("_", "")
        or "generaterequestsperminute" in blob.replace("_", "")
        or "inputtokenspermodelperminute" in blob.replace("_", "")
        or "free tier" in blob
        or "free_tier" in blob
    )


def _parse_model_json_text(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return {}
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    return json.loads(text)


# Prompt ile uyumlu fundus_findings (tek fundus goruntusu; OCT/IOP yok)
_FUNDUS_FINDING_KEYS = (
    "microaneurysm",
    "hemorrhage",
    "hard_exudates",
    "cotton_wool_spots",
    "irma",
    "venous_beading",
    "neovascularization",
    "macular_edema_suspected",
    "cataract_effect",
)

# Model asla %100 kesinlik vermesin (UI/triyaj)
_MODEL_CONFIDENCE_CEILING = 0.95
_DME_ODIR_CONFIDENCE_CAP = 0.55


def _clamp_confidence(x: float, ceiling: float = _MODEL_CONFIDENCE_CEILING) -> float:
    return max(0.0, min(ceiling, float(x)))


def _normalize_fundus_findings(raw: object) -> dict[str, bool]:
    if not isinstance(raw, dict):
        return {k: False for k in _FUNDUS_FINDING_KEYS}
    out: dict[str, bool] = {}
    for key in _FUNDUS_FINDING_KEYS:
        v = raw.get(key)
        if isinstance(v, bool):
            out[key] = v
        elif isinstance(v, str):
            out[key] = v.strip().lower() in ("true", "1", "yes", "evet")
        elif v is None:
            out[key] = False
        else:
            out[key] = bool(v)
    return out


def _coerce_bool(v: object) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "evet")
    if v is None:
        return False
    return bool(v)


def _is_ht_amd_risk_label(label: str) -> bool:
    """Gecici: analiz ciktisinda hipertansif retinopati ve AMD satirlari gosterilmez."""
    s = label.strip().lower()
    if "amd" in s or "makula dejenerasyon" in s or "macular degeneration" in s:
        return True
    if "hipertans" in s or "hypertensive" in s:
        return True
    return False


def _normalize_clinical_decision(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {
            "referableDr": False,
            "urgency": "routine",
            "recommendedActions": [],
            "followUpTr": "",
        }
    urg = str(raw.get("urgency") or "routine").strip().lower()
    if urg not in ("emergency", "urgent", "routine"):
        urg = "routine"
    actions = raw.get("recommended_actions")
    if not isinstance(actions, list):
        actions = []
    actions_clean = [str(a).strip() for a in actions if str(a).strip()][:30]
    ref_raw = raw.get("referable_dr")
    if isinstance(ref_raw, bool):
        ref_b = ref_raw
    elif isinstance(ref_raw, str):
        ref_b = ref_raw.strip().lower() in ("true", "1", "yes", "evet")
    else:
        ref_b = bool(ref_raw)
    return {
        "referableDr": ref_b,
        "urgency": urg,
        "recommendedActions": actions_clean,
        "followUpTr": str(raw.get("follow_up_tr") or "")[:4000],
    }


def _heatmap_enabled() -> bool:
    from dr_gradcam_heatmap import dr_heatmap_enabled

    return dr_heatmap_enabled()


def _predict_with_gemini_core(image: Image.Image, client: genai.Client) -> dict:
    img_send = _resize_pil_for_gemini(image)
    prompt = (
        "Sen retina hastalıkları konusunda uzman bir göz hastalıkları uzmanısın. "
        "Amacın fundus + klinik verilerden klinik karar destek raporu üretmektir.\n\n"
        "⚠️ BU İSTEKTE YALNIZCA TEK BİR FUNDUS GÖRÜNTÜSÜ VAR: OCT, IOP, görme alanı veya sistemik laboratuvar verisi YOK. "
        "Buna göre şüphe ve güven seviyelerini muhafazakar tut.\n\n"
        "⚠️ KRİTİK KURAL:\n"
        "Bu bir KESİN TANI sistemi değildir. Sadece klinik triyaj ve risk sınıflandırması yap.\n\n"
        "Asla:\n"
        "- %100 kesin tanı yazma; dr_confidence ve dme_confidence en fazla 0.95 olsun, mümkünse belirsizlikte 0.3–0.6 aralığı kullan.\n"
        "- Olmayan hastalığı yüksek güvenle belirtme.\n"
        "- Glokom bu raporda değerlendirilmez (fundus tek başına yetersiz); JSON'da glokom alanı YOK.\n\n"
        "---\n"
        "KLİNİK ÖNCELİK SIRASI:\n"
        "1. DR (Diabetic Retinopathy) evrelemesi (ICDR standardı)\n"
        "2. DME (Diabetic Macular Edema) VAR/YOK + şüphe (fundus: makula çevresi sert eksüda vb.; OCT yoksa düşük güven)\n"
        "3. PDR bulguları (NVE / NVD → neovascularization)\n"
        "4. İskemik bulgular (IRMA, venous beading)\n"
        "5. Makula bulguları; DME ile karıştırma\n"
        "6. Katarakt / görüntü kalitesi etkisi (cataract_effect)\n\n"
        "---\n"
        "DR EVRELEME (ICDR + 4-2-1 kuralı özeti):\n"
        "Severe NPDR: ≥4 kadranda hemoraji/mikroanevrizma, ≥2 kadranda venous beading, ≥1 kadranda IRMA (tek 2B fundusta "
        "tam sayım yapılamıyorsa ihtiyatlı sınıfla ve confidence düşür).\n"
        "PDR: NVE veya NVD (neovascularization) varsa PDR.\n"
        "Mild NPDR: esas olarak mikroanevrizma.\n"
        "Moderate NPDR: mild ötesi hemoraji/eksüda ama severe kriterleri karşılanmıyor.\n\n"
        "---\n"
        "DME:\n"
        "Makula çevresi sert eksüda veya maküler ödem şüphesi → dme_suspected true, dme_confidence muhafazakar. "
        "DME yoksa dme_suspected false ve clinical_reasoning veya uncertainty_note içinde kısa ifade.\n\n"
        "---\n"
        "AYRINTILI fundus_assessment: lezyonlari klinik acidan zengin betimle (egitim/hekim hizasi). "
        "presence alanlari yalnizca \"absent\" | \"present\" | \"uncertain\" kullan. "
        "burden: \"sparse\" (tek tuk) | \"widespread\" (yaygin) | \"unspecified\". "
        "Tek 2B fundusta kadran sayimi belirsizse uncertain/null ve notes_tr acikla.\n\n"
        "4-2-1 kurali (Severe NPDR): 4 kadranda hemoraji, 2 kadranda venous beading, 1 kadranda IRMA — "
        "herhangi biri klinik olarak saglaniyorsa implies_severe_npdr_if_any true olabilir (ihtiyatli).\n\n"
        "fundustan KESIN degerlendirilemeyenler: not_assessable_from_fundus altinda glaucoma, "
        "amd_definitive, hypertensive_retinopathy_definitive her zaman assessable:false ve "
        "nedenini reason_tr ile yaz (glokom: OCT/GF/pakimetri; AMD kesin tanı multimodal; HT retinopati korelasyon).\n\n"
        "SADECE JSON döndür. Açıklama, markdown, kod bloğu YOK.\n\n"
        "ZORUNLU JSON (tüm anahtarlar):\n"
        "{\n"
        '  "dr_grade": 0-4,\n'
        '  "dr_label": "kısa İngilizce etiket",\n'
        '  "dr_confidence": 0.0-0.95,\n'
        '  "dme_suspected": true/false,\n'
        '  "dme_confidence": 0.0-0.95,\n'
        '  "clinical_reasoning": "Türkçe; MA, hemoraji, eksuda, 4-2-1, makula, DME şüphesi ozet",\n'
        '  "fundus_findings": {\n'
        '    "microaneurysm": false,\n'
        '    "hemorrhage": false,\n'
        '    "hard_exudates": false,\n'
        '    "cotton_wool_spots": false,\n'
        '    "irma": false,\n'
        '    "venous_beading": false,\n'
        '    "neovascularization": false,\n'
        '    "macular_edema_suspected": false,\n'
        '    "cataract_effect": false\n'
        "  },\n"
        '  "fundus_assessment": {\n'
        '    "schema_version": "fundus_assessment_v1",\n'
        '    "microaneurysm": {"presence":"uncertain","burden":"unspecified","notes_tr":""},\n'
        '    "hemorrhage": {"presence":"uncertain","quadrants_affected":null,"burden":"unspecified","notes_tr":""},\n'
        '    "hard_exudates": {"presence":"uncertain","near_macula":null,"widespread":null,"notes_tr":""},\n'
        '    "cotton_wool_spots": {"presence":"uncertain","notes_tr":""},\n'
        '    "venous_beading": {"presence":"uncertain","notes_tr":""},\n'
        '    "irma": {"presence":"uncertain","notes_tr":""},\n'
        '    "neovascularization": {"presence":"uncertain","nvd":null,"nve":null,"notes_tr":""},\n'
        '    "quadrant_distribution": {"hemorrhage_quadrant_count":null,"pattern":"unspecified","notes_tr":""},\n'
        '    "rule_4_2_1": {"hemorrhage_four_quadrants":null,"venous_beading_two_quadrants":null,'
        '"irma_one_quadrant":null,"implies_severe_npdr_if_any":null,"notes_tr":""},\n'
        '    "macula": {"hard_exudates_near_macula":null,"edema_suspected_clinical":null,'
        '"affects_treatment_decision":null,"notes_tr":""},\n'
        '    "dme_indirect": {"inferred_from_fundus":null,"rationale_tr":"","critical_finding":null},\n'
        '    "lesion_severity": {"overall_pattern":"unspecified","notes_tr":""},\n'
        '    "not_assessable_from_fundus": {\n'
        '      "glaucoma": {"assessable":false,"reason_tr":""},\n'
        '      "amd_definitive": {"assessable":false,"reason_tr":""},\n'
        '      "hypertensive_retinopathy_definitive": {"assessable":false,"reason_tr":""}\n'
        "    }\n"
        "  },\n"
        '  "clinical_decision": {\n'
        '    "referable_dr": false,\n'
        '    "urgency": "routine | urgent | emergency",\n'
        '    "recommended_actions": ["Türkçe öneriler"],\n'
        '    "follow_up_tr": ""\n'
        "  },\n"
        '  "uncertainty_note": "görüntü kalitesi vb. veya boş string"\n'
        "}\n"
    )
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[prompt, img_send],
        config=types.GenerateContentConfig(
            temperature=0.15,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )
    try:
        raw = (resp.text or "").strip()
    except ValueError as err:
        raise ValueError("Gemini yaniti okunamadi veya engellendi.") from err

    data = _parse_model_json_text(raw)
    try:
        grade_i = int(data.get("dr_grade", 0))
    except (TypeError, ValueError):
        grade_i = 0
    grade_i = max(0, min(4, grade_i))

    try:
        conf_f = float(data.get("dr_confidence", 0.65))
    except (TypeError, ValueError):
        conf_f = 0.65
    conf_f = _clamp_confidence(conf_f)

    dme_suspected = _coerce_bool(data.get("dme_suspected"))
    try:
        dme_confidence = float(data.get("dme_confidence", 0.0))
    except (TypeError, ValueError):
        dme_confidence = 0.0
    dme_confidence = _clamp_confidence(dme_confidence)
    uncertainty_note = str(data.get("uncertainty_note") or "").strip()[:4000]

    label = DR_GRADE_LABELS_TR[grade_i]
    dr_label = str(data.get("dr_label") or "").strip()
    clinical_reasoning = str(data.get("clinical_reasoning") or "").strip()[:8000]

    fundus_findings = _normalize_fundus_findings(data.get("fundus_findings"))
    fundus_assessment = normalize_fundus_assessment(data.get("fundus_assessment"))
    clinical_decision = _normalize_clinical_decision(data.get("clinical_decision"))

    odir_results: list[dict] = []
    if dme_suspected:
        odir_results.insert(
            0,
            {
                "label": "DME (diyabetik maküler ödem şüphesi)",
                "confidence": min(dme_confidence, _DME_ODIR_CONFIDENCE_CAP),
                "note": "Triyaj; OCT ile doğrulanmalı",
            },
        )
    for item in data.get("other_risks") or []:
        if not isinstance(item, dict):
            continue
        cond = (item.get("condition_tr") or item.get("label") or "").strip()
        if not cond or _is_ht_amd_risk_label(cond):
            continue
        try:
            r_i = int(item.get("risk_0_100", 0))
        except (TypeError, ValueError):
            r_i = 0
        r_i = max(0, min(100, r_i))
        note_tr = (item.get("note_tr") or "").strip()
        entry = {"label": cond, "confidence": r_i / 100.0}
        if note_tr:
            entry["note"] = note_tr[:80]
        odir_results.append(entry)

    if not odir_results:
        odir_results.append({"label": "Ek risk raporu yok", "confidence": 0.0})

    heatmap_plus: str | None = None
    heatmap_method: str | None = None
    heatmap_cam_idx: int | None = None
    if _heatmap_enabled():
        try:
            from dr_gradcam_heatmap import try_dr_gradcam_data_uri

            b64, cam_idx = try_dr_gradcam_data_uri(image, class_idx=grade_i)
            if not b64:
                # app.py ile ayni: CNN argmax sinifi uzerinden CAM (LLM evresi farkli olsa bile gorsel uret)
                b64, cam_idx = try_dr_gradcam_data_uri(image, class_idx=None)
            if b64:
                heatmap_plus = f"data:image/png;base64,{b64}"
                heatmap_method = "dr_gradcam_local"
                if cam_idx >= 0 and cam_idx != grade_i:
                    heatmap_cam_idx = cam_idx
        except Exception:
            pass

    # Prompt degisince veri seti siseleme; export manifest ile eslestir
    GEMINI_PROMPT_VERSION = (os.environ.get("GEMINI_PROMPT_VERSION") or "1").strip() or "1"
    inference_meta: dict = {
        "backend": "gemini",
        "model": GEMINI_MODEL,
        "promptVersion": GEMINI_PROMPT_VERSION,
        "note": "LLM tabanli triyaj; klinik karar yerine gecmez.",
    }
    if heatmap_method:
        inference_meta["heatmapMethod"] = heatmap_method
    if heatmap_cam_idx is not None:
        inference_meta["heatmapClassIdx"] = heatmap_cam_idx
        inference_meta["heatmapClassNote"] = (
            "Grad-CAM sinifi yerel DenseNet argmax; drGrade LLM ciktisi."
        )

    return {
        "success": True,
        "drGrade": grade_i,
        "pytorch": {
            "label": label,
            "confidence": conf_f,
            "rawConfidence": conf_f,
            "temperature": None,
        },
        "odir": {"results": odir_results},
        "fundusFindings": fundus_findings,
        "fundusAssessment": fundus_assessment,
        "drLabel": dr_label,
        "clinicalReasoning": clinical_reasoning,
        "clinicalDecision": clinical_decision,
        "dmeSuspected": dme_suspected,
        "dmeConfidence": dme_confidence,
        "uncertaintyNote": uncertainty_note,
        "heatmapPlus": heatmap_plus,
        "uncertainty": None,
        "ood": None,
        "localization": None,
        "inference": inference_meta,
    }


def _predict_with_gemini(image: Image.Image) -> dict:
    keys = _gemini_api_key_list()
    if not keys:
        raise GeminiAllKeysExhausted(
            "Gemini API anahtari tanimli degil (GEMINI_API_KEY veya GEMINI_API_KEYS)."
        )
    last_err: BaseException | None = None
    for key in keys:
        client = genai.Client(api_key=key)
        try:
            return _predict_with_gemini_core(image, client)
        except genai_errors.APIError as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
        except Exception as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
    raise GeminiAllKeysExhausted(
        str(last_err) if last_err else "Tum Gemini anahtarlari kota/limit ile reddedildi."
    )


# --- Makula OCT (Gemini; fundus /predict akisindan bagimsiz) ---

OCT_OUTPUT_LANG_INSTRUCTION_TR = (
    "CIKTI DILI: Tum aciklayici metin alanlarini (image_quality, findings, supporting_findings, "
    "contradicting_findings, clinical_summary, recommendations icerikleri) TURKCE yaz. "
    "JSON anahtar adlari asagidaki gibi INGILIZCE kalsin. 'likelihood' alanlarinda sadece su "
    "uc degerden birini kullan: Dusuk | Orta | Yuksek. "
    "Kisaltmalari (DME, AMD, ERM, VMT, CSR, RVO) ve tipik Ingilizce hastalik kisaltmalarini "
    "metin icerisinde gerekirse koruyabilirsin."
)

OCT_OUTPUT_LANG_INSTRUCTION_EN = (
    "OUTPUT LANGUAGE: Write all narrative fields (image_quality, findings, supporting_findings, "
    "contradicting_findings, clinical_summary, recommendations) in clear English. "
    "Use JSON keys exactly as specified. For 'likelihood' use only: Low | Moderate | High."
)

OCT_BASE_PROMPT = """
You are an expert ophthalmologist specializing in retinal diseases.

Analyze the provided macular OCT image and generate a structured clinical assessment.

IMPORTANT RULES:
- Do NOT give definitive diagnosis.
- Use probabilistic and descriptive medical language.
- Base your reasoning only on visible OCT features.
- If image quality is insufficient, clearly state it.

TASKS:

1. Identify key OCT findings:
- Retinal thickness changes (thickening / thinning)
- Intraretinal or subretinal fluid
- Hyperreflective or hyporeflective areas
- Disruption of retinal layers (especially ellipsoid zone)
- Vitreomacular interface abnormalities

2. Evaluate the likelihood of the following conditions:
- Diabetic Macular Edema (DME)
- Age-related Macular Degeneration (AMD)
- Macular Hole
- Epiretinal Membrane (ERM) / Vitreomacular Traction (VMT)
- Central Serous Retinopathy (CSR)
- Retinal Vein Occlusion (RVO)

For EACH condition provide:
- Likelihood: Low / Moderate / High (or Turkish output: Dusuk / Orta / Yuksek if instructed)
- Supporting findings
- Contradicting findings (if any)

3. Generate a concise clinical summary for a doctor:
- 3-5 sentences
- Clear, medical, no unnecessary explanation

4. Provide follow-up recommendations:
- Additional imaging if needed
- Monitoring vs referral urgency

OUTPUT FORMAT (STRICT JSON only, no markdown fences):

{
  "image_quality": "Good / Moderate / Poor",
  "findings": [
    "..."
  ],
  "conditions": [
    {
      "name": "DME",
      "likelihood": "Low",
      "supporting_findings": ["..."],
      "contradicting_findings": ["..."]
    },
    {
      "name": "AMD",
      "likelihood": "Moderate",
      "supporting_findings": [],
      "contradicting_findings": []
    }
  ],
  "clinical_summary": "...",
  "recommendations": [
    "...",
    "..."
  ]
}

Include all six conditions (DME, AMD, Macular Hole, ERM/VMT, CSR, RVO) in "conditions" with the exact name format you judge best, but each must have the four fields above.
"""


def _oct_locale_to_instruction(locale_raw: str) -> str:
    s = (locale_raw or "").strip().lower()
    if s.startswith("tr"):
        return OCT_OUTPUT_LANG_INSTRUCTION_TR
    return OCT_OUTPUT_LANG_INSTRUCTION_EN


def _coerce_str_list(v: object, max_len: int = 50) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        t = v.strip()
        return [t] if t else []
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        t = str(item).strip()
        if t:
            out.append(t)
        if len(out) >= max_len:
            break
    return out


def _normalize_likelihood(raw: str) -> str:
    s = (raw or "").strip()
    s_low = s.lower()
    tr_map = {
        "düşük": "low",
        "dusuk": "low",
        "orta": "moderate",
        "yüksek": "high",
        "yuksek": "high",
    }
    if s_low in tr_map:
        s_low = tr_map[s_low]
    en = {"low", "moderate", "high"}
    if s_low in en:
        return s_low
    return "low"


def _normalize_oct_assessment(data: object) -> dict:
    if not isinstance(data, dict):
        data = {}
    d = data
    img_q = str(d.get("image_quality") or "").strip() or "Moderate"
    findings = _coerce_str_list(d.get("findings"), 40)
    raw_conds = d.get("conditions")
    conditions: list[dict] = []
    if isinstance(raw_conds, list):
        for c in raw_conds:
            if not isinstance(c, dict):
                continue
            name = str(c.get("name") or "").strip() or "—"
            conditions.append(
                {
                    "name": name,
                    "likelihood": _normalize_likelihood(str(c.get("likelihood") or "Low")),
                    "supportingFindings": _coerce_str_list(
                        c.get("supporting_findings"), 30
                    ),
                    "contradictingFindings": _coerce_str_list(
                        c.get("contradicting_findings"), 30
                    ),
                }
            )
    summary = str(d.get("clinical_summary") or "").strip()[:12_000]
    recs = _coerce_str_list(d.get("recommendations"), 30)
    return {
        "imageQuality": img_q,
        "findings": findings,
        "conditions": conditions,
        "clinicalSummary": summary,
        "recommendations": recs,
    }


def _predict_oct_with_gemini_core(
    image: Image.Image, client: genai.Client, locale_tag: str
) -> dict:
    img_send = _resize_pil_for_gemini(image)
    lang_inst = _oct_locale_to_instruction(locale_tag)
    prompt = OCT_BASE_PROMPT.strip() + "\n\n" + lang_inst
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[prompt, img_send],
        config=types.GenerateContentConfig(
            temperature=0.15,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )
    try:
        raw = (resp.text or "").strip()
    except ValueError as err:
        raise ValueError("Gemini OCT yaniti okunamadi veya engellendi.") from err

    data = _parse_model_json_text(raw)
    if not data:
        raise ValueError("Gemini OCT ciktisi bos veya gecersiz JSON.")
    normalized = _normalize_oct_assessment(data)
    return {
        "success": True,
        "oct": normalized,
        "inference": {
            "backend": "gemini-oct",
            "model": GEMINI_MODEL,
            "locale": "tr" if (locale_tag or "").strip().lower().startswith("tr") else "en",
        },
    }


def _predict_oct_with_gemini(image: Image.Image, locale_tag: str) -> dict:
    keys = _gemini_api_key_list()
    if not keys:
        raise GeminiAllKeysExhausted(
            "Gemini API anahtari tanimli degil (GEMINI_API_KEY veya GEMINI_API_KEYS). "
            "Makula OCT analizi yalnizca Gemini ile calisir."
        )
    last_err: BaseException | None = None
    for key in keys:
        client = genai.Client(api_key=key)
        try:
            return _predict_oct_with_gemini_core(image, client, locale_tag)
        except genai_errors.APIError as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
        except Exception as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
    raise GeminiAllKeysExhausted(
        str(last_err) if last_err else "Tum Gemini anahtarlari kota/limit ile reddedildi."
    )


@app.route("/predict", methods=["POST"])
def predict():
    request_id = resolve_request_id(request.headers)
    gateway_key = request.headers.get("X-AI-Gateway-Key", "")
    if gateway_key != AI_GATEWAY_SHARED_SECRET:
        return jsonify({
            "success": False,
            "error": "Yetkisiz AI erisimi.",
            "requestId": request_id,
        }), 401

    client_ip = (request.headers.get("X-Forwarded-For", "") or request.remote_addr or "unknown").split(",")[0].strip()
    if _is_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.",
            "requestId": request_id,
        }), 429

    patient_id = None
    try:
        patient_id = (request.form.get("patientId") or "").strip() or None
    except Exception:
        patient_id = None

    try:
        file = request.files.get("image")
        image = _safe_load_image(file)
        w_local = _local_multitask_weights_path()
        if USE_LOCAL_MULTITASK_FIRST and w_local:
            try:
                from local_multitask_inference import predict_pil_gemini_shaped

                return jsonify(
                    predict_pil_gemini_shaped(image, weights_path=w_local)
                )
            except Exception as loc_err:
                log_structured_error(
                    request_id=request_id,
                    route="/predict",
                    action="LOCAL_MULTITASK_FAILED",
                    error_message=str(loc_err)[:2500],
                    stack=traceback.format_exc(),
                    patient_id=patient_id,
                    payload_summary=_safe_predict_payload_summary(),
                )
                if not _gemini_api_key_list() and not _densenet_fallback_available():
                    return jsonify({
                        "success": False,
                        "error": (
                            "Yerel multitask calistirilamadi; Gemini anahtari ve DenseNet agirlik dosyasi (model.pth/model.pt) yok. "
                            f"Detay: {loc_err}"
                        ),
                        "requestId": request_id,
                    }), 503

        if _gemini_api_key_list():
            try:
                return jsonify(_predict_with_gemini(image))
            except GeminiAllKeysExhausted as gex:
                log_structured_error(
                    request_id=request_id,
                    route="/predict",
                    action="GEMINI_ALL_KEYS_EXHAUSTED",
                    error_message=str(gex)[:2500],
                    patient_id=patient_id,
                    payload_summary=_safe_predict_payload_summary(),
                )

        from densenet_dr_fallback import predict_densenet_gemini_shaped

        fb = predict_densenet_gemini_shaped(image)
        if fb:
            return jsonify(fb)

        return jsonify({
            "success": False,
            "error": (
                "Gemini kullanilamadi ve yerel DR modeli (models/model.pth veya model.pt) yok veya calistirilamadi."
            ),
            "requestId": request_id,
        }), 503
    except ValueError as err:
        log_structured_error(
            request_id=request_id,
            route="/predict",
            action="INVALID_REQUEST",
            error_message=str(err),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": str(err),
            "requestId": request_id,
        }), 400
    except genai_errors.APIError as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya dakika basina cok fazla istek/token kullanildi. "
                    "Yaklasik 1 dakika bekleyip tekrar deneyin; gorsel cok buyukse kucultun. "
                    "Kalici kullanim icin Google AI Studio ucretli kotaya gecilebilir."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        log_structured_error(
            request_id=request_id,
            route="/predict",
            action="GEMINI_API_ERROR",
            error_message=str(err)[:2500],
            stack=traceback.format_exc(),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": f"Gemini API hatasi: {err.message or err}",
            "requestId": request_id,
        }), 502
    except Exception as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya dakika basina cok fazla istek/token kullanildi. "
                    "Yaklasik 1 dakika bekleyip tekrar deneyin; gerekirse GEMINI_MAX_IMAGE_SIDE=256 ayarlayin."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        cause = getattr(err, "__cause__", None)
        cause_msg = str(cause) if cause is not None else None
        log_structured_error(
            request_id=request_id,
            route="/predict",
            action="PREDICT_FAILED",
            error_message=str(err),
            stack=traceback.format_exc(),
            cause=cause_msg,
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": "Analiz sirasinda beklenmeyen bir hata olustu.",
            "requestId": request_id,
        }), 500


@app.route("/predict-oct", methods=["POST"])
def predict_oct():
    request_id = resolve_request_id(request.headers)
    gateway_key = request.headers.get("X-AI-Gateway-Key", "")
    if gateway_key != AI_GATEWAY_SHARED_SECRET:
        return jsonify({
            "success": False,
            "error": "Yetkisiz AI erisimi.",
            "requestId": request_id,
        }), 401

    client_ip = (request.headers.get("X-Forwarded-For", "") or request.remote_addr or "unknown").split(",")[0].strip()
    if _is_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.",
            "requestId": request_id,
        }), 429

    patient_id = None
    try:
        patient_id = (request.form.get("patientId") or "").strip() or None
    except Exception:
        patient_id = None

    locale_tag = "en"
    try:
        locale_tag = (request.form.get("locale") or "en").strip() or "en"
    except Exception:
        locale_tag = "en"

    try:
        file = request.files.get("image")
        image = _safe_load_image(file)
        return jsonify(_predict_oct_with_gemini(image, locale_tag))
    except ValueError as err:
        log_structured_error(
            request_id=request_id,
            route="/predict-oct",
            action="INVALID_REQUEST",
            error_message=str(err),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": str(err),
            "requestId": request_id,
        }), 400
    except GeminiAllKeysExhausted as gex:
        log_structured_error(
            request_id=request_id,
            route="/predict-oct",
            action="GEMINI_ALL_KEYS_EXHAUSTED",
            error_message=str(gex)[:2500],
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": (
                "Makula OCT analizi icin tum Gemini anahtarlari kotaya takildi veya anahtar yok. "
                "Biraz bekleyip tekrar deneyin veya yoneticiyle iletisime gecin."
            ),
            "requestId": request_id,
        }), 503
    except genai_errors.APIError as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict-oct",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya dakika basina cok fazla istek/token kullanildi. "
                    "Yaklasik 1 dakika bekleyip tekrar deneyin; gorsel cok buyukse kucultun."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        log_structured_error(
            request_id=request_id,
            route="/predict-oct",
            action="GEMINI_API_ERROR",
            error_message=str(err)[:2500],
            stack=traceback.format_exc(),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": f"Gemini API hatasi: {err.message or err}",
            "requestId": request_id,
        }), 502
    except Exception as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict-oct",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya istek limiti asildi. "
                    "Biraz bekleyip tekrar deneyin; gerekirse GEMINI_MAX_IMAGE_SIDE=256 deneyin."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        cause = getattr(err, "__cause__", None)
        cause_msg = str(cause) if cause is not None else None
        log_structured_error(
            request_id=request_id,
            route="/predict-oct",
            action="PREDICT_OCT_FAILED",
            error_message=str(err),
            stack=traceback.format_exc(),
            cause=cause_msg,
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": "Makula OCT analizi sirasinda beklenmeyen bir hata olustu.",
            "requestId": request_id,
        }), 500


# --- FFA (Fluorescein fundus anjiyografi) ---

FFA_OUTPUT_LANG_INSTRUCTION_TR = (
    "CIKTI: Asagidaki ZORUNLU JSON semasina harfiyen uy. Anahtar adlari Turkce kalsin. "
    "olasilik alanlarinda yalnizca: Dusuk | Orta | Yüksek. "
    "aktivite_degerlendirmesi icinde: Var / Yok / Belirsiz ve neovaskularizasyon ile sizinti icin Var / Yok / Şüpheli."
)

FFA_OUTPUT_LANG_INSTRUCTION_EN = (
    "OUTPUT: Obey the JSON schema below exactly. Use English for all narrative string values. "
    "Use these keys in English: image_quality, phase_assessment, findings, diseases, activity_assessment, "
    "clinical_summary, recommendations, confidence_score. "
    "diseases[].likelihood: only Low | Moderate | High. "
    "activity_assessment: use Present | Absent | Uncertain for active_disease; "
    "neovascularization and leakage: Present | Absent | Suspected."
)

FFA_BASE_PROMPT_TR = """
Sen retina hastalıkları konusunda uzman bir göz hastalıkları hekimi gibi davranan klinik bir AI asistanısın.

Verilen Fluorescein Fundus Anjiyografi (FFA) görüntüsünü analiz et ve klinik bir değerlendirme raporu oluştur.

ÖNEMLİ KURALLAR:
- Kesin tanı koyma.
- "Uyumlu olabilir", "lehine bulgular", "şüpheli" gibi medikal olasılık dili kullan.
- Sadece görüntüdeki FFA bulgularına dayan.
- Faz bilgisi net değilse bunu belirt.
- Görüntü kalitesi yetersizse açıkça yaz.

KLİNİK AMAÇ:
FFA özellikle aşağıdaki hastalıkların tanı ve aktivite değerlendirmesinde kullanılır:
- Diyabetik Retinopati
- Retinal Ven Tıkanıklığı (RVO)
- Yaşa Bağlı Makula Dejenerasyonu (CNV)
- Santral Seröz Koryoretinopati (CSR)
- Üveit / retinal vaskülit

GÖREVLER:

1. FFA bulgularını değerlendir:
- Boyanma (staining)
- Sızıntı (leakage)
- Non-perfüzyon alanları
- Kapiller kaçak
- Neovaskülarizasyon bulguları
- Hiperfloresans / hipofloresans alanlar
- Makula tutulumu

2. Aşağıdaki hastalıklar için olasılık değerlendir:
- Diyabetik Retinopati (DR)
- Retinal Ven Tıkanıklığı (RVO)
- AMD (koroidal neovaskülarizasyon - CNV)
- CSR
- Üveit / retinal vaskülit

Her hastalık için:
- Olasılık: Düşük / Orta / Yüksek
- Destekleyen bulgular
- Aykırı bulgular

3. Aktivite değerlendirmesi yap:
- Aktif hastalık var mı?
- Neovaskülarizasyon var mı?
- Aktif sızıntı var mı?

4. Klinik özet yaz:
- 3–5 cümle
- Net, tıbbi ve doktor diliyle

5. Öneriler:
- Takip planı
- Ek tetkikler (OCT, tekrar FFA vb.)
- Tedavi gerekliliği (genel ifade)

ÇIKTI FORMATI (SADECE JSON, aciklama yok):

{
  "goruntu_kalitesi": "İyi / Orta / Kötü",
  "faz_degerlendirmesi": "Erken / Orta / Geç / Belirsiz",
  "bulgular": [
    "..."
  ],
  "hastaliklar": [
    {
      "isim": "Diyabetik Retinopati",
      "olasilik": "Yüksek",
      "destekleyen_bulgular": [],
      "aykiri_bulgular": []
    }
  ],
  "aktivite_degerlendirmesi": {
    "aktif_hastalik": "Var / Yok / Belirsiz",
    "neovaskularizasyon": "Var / Yok / Şüpheli",
    "sizinti": "Var / Yok / Şüpheli"
  },
  "klinik_ozet": "...",
  "oneriler": [
    "..."
  ],
  "guven_skoru": 0
}

Bes hastalik satiri (DR, RVO, AMD/CNV, CSR, Uveit/vaskulit) "hastaliklar" listesinde olmali. guven_skoru 0-100 tamsayi.
"""

FFA_BASE_PROMPT_EN = """
You are a clinical AI assistant acting like a specialist ophthalmologist in retinal disease.

Analyze the given Fluorescein Fundus Angiography (FFA) image and produce a structured clinical report.

CRITICAL RULES:
- No definitive diagnosis.
- Use probabilistic, cautious medical phrasing.
- Rely only on FFA features visible in the image.
- If angiographic phase is unclear, say so.
- If image quality is poor, state it clearly.

CLINICALLY FFA is used to assess diagnosis and especially activity for:
- Diabetic retinopathy
- Retinal vein occlusion (RVO)
- Neovascular AMD (CNV)
- Central serous chorioretinopathy
- Uveitis / retinal vasculitis

TASKS:
1) Describe FFA findings: staining, leakage, non-perfusion, capillary leakage, neovascularization-related patterns, hyper/hypofluorescence, macular involvement.
2) For each listed disease, give probability (Low/Moderate/High), supporting features, and contradictory features.
3) Activity: active disease? neovascularization? active leakage?
4) 3-5 sentence clinical summary for a physician.
5) Recommendations: follow-up, additional tests (OCT, repeat FFA, etc.), and general need for treatment discussion.

Output ONLY valid JSON (no markdown) using exactly these English keys and shapes:

{
  "image_quality": "Good / Moderate / Poor",
  "phase_assessment": "Early / Mid / Late / Unclear",
  "findings": ["..."],
  "diseases": [
    {
      "name": "Diabetic retinopathy",
      "likelihood": "Low",
      "supporting_findings": [],
      "contradicting_findings": []
    }
  ],
  "activity_assessment": {
    "active_disease": "Present / Absent / Uncertain",
    "neovascularization": "Present / Absent / Suspected",
    "leakage": "Present / Absent / Suspected"
  },
  "clinical_summary": "...",
  "recommendations": ["..."],
  "confidence_score": 0
}

Include all five conditions (DR, RVO, AMD/CNV, CSR, uveitis/vasculitis) in "diseases". confidence_score is an integer 0-100.
"""


def _dict_get(d: object, *keys: str) -> object | None:
    if not isinstance(d, dict):
        return None
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _normalize_confidence_0_100(v: object) -> int:
    try:
        if isinstance(v, bool):
            return 0
        if isinstance(v, (int, float)):
            i = int(round(float(v)))
        else:
            i = int(round(float(str(v).strip().replace(",", "."))))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, i))


def _normalize_ffa_assessment(data: object, source_locale: str) -> dict:
    if not isinstance(data, dict):
        data = {}
    d: dict = data  # type: ignore[assignment]
    is_tr = (source_locale or "").strip().lower().startswith("tr")

    if is_tr:
        img_q = str(
            _dict_get(d, "goruntu_kalitesi", "image_quality") or ""
        ).strip() or "Orta"
        phase = str(
            _dict_get(d, "faz_degerlendirmesi", "phase_assessment") or ""
        ).strip() or "Belirsiz"
        findings = _coerce_str_list(_dict_get(d, "bulgular", "findings"), 50)
        raw_dis = _dict_get(d, "hastaliklar", "diseases")
    else:
        img_q = str(
            _dict_get(d, "image_quality", "goruntu_kalitesi") or ""
        ).strip() or "Moderate"
        phase = str(
            _dict_get(d, "phase_assessment", "faz_degerlendirmesi") or ""
        ).strip() or "Unclear"
        findings = _coerce_str_list(_dict_get(d, "findings", "bulgular"), 50)
        raw_dis = _dict_get(d, "diseases", "hastaliklar")

    diseases: list[dict] = []
    if isinstance(raw_dis, list):
        for c in raw_dis:
            if not isinstance(c, dict):
                continue
            name = str(
                _dict_get(c, "isim", "name", "disease", "condition") or ""
            ).strip() or "—"
            lik = str(
                _dict_get(
                    c,
                    "olasilik",
                    "likelihood",
                )
                or ("Düşük" if is_tr else "Low")
            )
            sup = _coerce_str_list(
                _dict_get(
                    c,
                    "destekleyen_bulgular",
                    "supporting_findings",
                ),
                40,
            )
            con = _coerce_str_list(
                _dict_get(
                    c,
                    "aykiri_bulgular",
                    "aykirı_bulgular",
                    "contradicting_findings",
                ),
                40,
            )
            diseases.append(
                {
                    "name": name,
                    "likelihood": _normalize_likelihood(lik),
                    "supportingFindings": sup,
                    "contradictingFindings": con,
                }
            )

    if is_tr:
        raw_act = _dict_get(d, "aktivite_degerlendirmesi", "activity_assessment")
    else:
        raw_act = _dict_get(d, "activity_assessment", "aktivite_degerlendirmesi")

    act: dict = raw_act if isinstance(raw_act, dict) else {}
    if is_tr:
        d_active, d_neo, d_leak = "Belirsiz", "Şüpheli", "Şüpheli"
    else:
        d_active, d_neo, d_leak = "Uncertain", "Suspected", "Suspected"
    active_dis = str(
        _dict_get(
            act,
            "aktif_hastalik",
            "active_disease",
        )
        or d_active
    ).strip()
    neo = str(
        _dict_get(
            act,
            "neovaskularizasyon",
            "neovascularization",
        )
        or d_neo
    ).strip()
    leak = str(
        _dict_get(
            act,
            "sizinti",
            "sızıntı",
            "sızinti",
            "leakage",
        )
        or d_leak
    ).strip()

    if is_tr:
        summary = str(_dict_get(d, "klinik_ozet", "clinical_summary") or "").strip()
        recs = _coerce_str_list(_dict_get(d, "oneriler", "recommendations"), 40)
        conf = _normalize_confidence_0_100(
            _dict_get(d, "guven_skoru", "confidence_score")
        )
    else:
        summary = str(_dict_get(d, "clinical_summary", "klinik_ozet") or "").strip()
        recs = _coerce_str_list(_dict_get(d, "recommendations", "oneriler"), 40)
        conf = _normalize_confidence_0_100(
            _dict_get(d, "confidence_score", "guven_skoru")
        )

    return {
        "imageQuality": img_q,
        "phaseAssessment": phase,
        "findings": findings,
        "diseases": diseases,
        "activity": {
            "activeDisease": active_dis,
            "neovascularization": neo,
            "leakage": leak,
        },
        "clinicalSummary": summary[:12_000],
        "recommendations": recs,
        "confidenceScore": conf,
    }


def _ffa_locale_to_tr_prompt(locale_raw: str) -> tuple[str, str]:
    s = (locale_raw or "").strip().lower()
    if s.startswith("tr"):
        return (FFA_BASE_PROMPT_TR.strip() + "\n\n" + FFA_OUTPUT_LANG_INSTRUCTION_TR, "tr")
    return (FFA_BASE_PROMPT_EN.strip() + "\n\n" + FFA_OUTPUT_LANG_INSTRUCTION_EN, "en")


def _predict_ffa_with_gemini_core(
    image: Image.Image, client: genai.Client, locale_tag: str
) -> dict:
    img_send = _resize_pil_for_gemini(image)
    body, out_loc = _ffa_locale_to_tr_prompt(locale_tag)
    prompt = body
    resp = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[prompt, img_send],
        config=types.GenerateContentConfig(
            temperature=0.15,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )
    try:
        raw = (resp.text or "").strip()
    except ValueError as err:
        raise ValueError("Gemini FFA yaniti okunamadi veya engellendi.") from err

    data = _parse_model_json_text(raw)
    if not data:
        raise ValueError("Gemini FFA ciktisi bos veya gecersiz JSON.")
    normalized = _normalize_ffa_assessment(data, out_loc)
    return {
        "success": True,
        "ffa": normalized,
        "inference": {
            "backend": "gemini-ffa",
            "model": GEMINI_MODEL,
            "locale": "tr" if out_loc == "tr" else "en",
        },
    }


def _predict_ffa_with_gemini(image: Image.Image, locale_tag: str) -> dict:
    keys = _gemini_api_key_list()
    if not keys:
        raise GeminiAllKeysExhausted(
            "Gemini API anahtari tanimli degil. FFA analizi yalnizca Gemini ile calisir."
        )
    last_err: BaseException | None = None
    for key in keys:
        client = genai.Client(api_key=key)
        try:
            return _predict_ffa_with_gemini_core(image, client, locale_tag)
        except genai_errors.APIError as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
        except Exception as err:
            last_err = err
            if _is_gemini_quota_error(err):
                continue
            raise
    raise GeminiAllKeysExhausted(
        str(last_err) if last_err else "Tum Gemini anahtarlari kota/limit ile reddedildi."
    )


@app.route("/predict-ffa", methods=["POST"])
def predict_ffa():
    request_id = resolve_request_id(request.headers)
    gateway_key = request.headers.get("X-AI-Gateway-Key", "")
    if gateway_key != AI_GATEWAY_SHARED_SECRET:
        return jsonify({
            "success": False,
            "error": "Yetkisiz AI erisimi.",
            "requestId": request_id,
        }), 401

    client_ip = (request.headers.get("X-Forwarded-For", "") or request.remote_addr or "unknown").split(",")[0].strip()
    if _is_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "error": "Cok fazla istek gonderdiniz. Lutfen biraz bekleyin.",
            "requestId": request_id,
        }), 429

    patient_id = None
    try:
        patient_id = (request.form.get("patientId") or "").strip() or None
    except Exception:
        patient_id = None

    locale_tag = "en"
    try:
        locale_tag = (request.form.get("locale") or "en").strip() or "en"
    except Exception:
        locale_tag = "en"

    try:
        file = request.files.get("image")
        image = _safe_load_image(file)
        return jsonify(_predict_ffa_with_gemini(image, locale_tag))
    except ValueError as err:
        log_structured_error(
            request_id=request_id,
            route="/predict-ffa",
            action="INVALID_REQUEST",
            error_message=str(err),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": str(err),
            "requestId": request_id,
        }), 400
    except GeminiAllKeysExhausted as gex:
        log_structured_error(
            request_id=request_id,
            route="/predict-ffa",
            action="GEMINI_ALL_KEYS_EXHAUSTED",
            error_message=str(gex)[:2500],
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": (
                "FFA analizi icin tum Gemini anahtarlari kotaya takildi veya anahtar yok. "
                "Biraz bekleyip tekrar deneyin veya yoneticiyle iletisime gecin."
            ),
            "requestId": request_id,
        }), 503
    except genai_errors.APIError as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict-ffa",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya dakika basina cok fazla istek/token kullanildi. "
                    "Yaklasik 1 dakika bekleyip tekrar deneyin; gorsel cok buyukse kucultun."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        log_structured_error(
            request_id=request_id,
            route="/predict-ffa",
            action="GEMINI_API_ERROR",
            error_message=str(err)[:2500],
            stack=traceback.format_exc(),
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": f"Gemini API hatasi: {err.message or err}",
            "requestId": request_id,
        }), 502
    except Exception as err:
        if _is_gemini_quota_error(err):
            log_structured_error(
                request_id=request_id,
                route="/predict-ffa",
                action="GEMINI_QUOTA_EXCEEDED",
                error_message=str(err)[:2500],
                patient_id=patient_id,
                payload_summary=_safe_predict_payload_summary(),
            )
            return jsonify({
                "success": False,
                "error": (
                    "Gemini ucretsiz kotasi asildi veya istek limiti asildi. "
                    "Biraz bekleyip tekrar deneyin; gerekirse GEMINI_MAX_IMAGE_SIDE=256 deneyin."
                ),
                "requestId": request_id,
                "geminiQuotaExceeded": True,
            }), 429
        cause = getattr(err, "__cause__", None)
        cause_msg = str(cause) if cause is not None else None
        log_structured_error(
            request_id=request_id,
            route="/predict-ffa",
            action="PREDICT_FFA_FAILED",
            error_message=str(err),
            stack=traceback.format_exc(),
            cause=cause_msg,
            patient_id=patient_id,
            payload_summary=_safe_predict_payload_summary(),
        )
        return jsonify({
            "success": False,
            "error": "FFA analizi sirasinda beklenmeyen bir hata olustu.",
            "requestId": request_id,
        }), 500


if __name__ == "__main__":
    # app.py genelde AI_PORT=5000; Gemini servisi varsayilan 5001 (AI_GEMINI_PORT ile degistir).
    _port = int(os.environ.get("AI_GEMINI_PORT", "5001"))
    app.run(
        host=os.environ.get("AI_HOST", "0.0.0.0"),
        port=_port,
        debug=FLASK_DEBUG,
    )
