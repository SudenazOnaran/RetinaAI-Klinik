"""
Yerel multitask ciktilarindan Gemini benzeri Turkce klinik metin ve karar metni uretir.
Serbest LLM degil; sablon + bulgu/evre birlestirmesi.
"""
from __future__ import annotations

from typing import Any

from fundus_constants import DR_GRADE_LABELS_EN_SHORT, FUNDUS_FINDING_KEYS

_FINDING_PHRASE_TR: dict[str, str] = {
    "microaneurysm": "mikroanevrizmalar",
    "hemorrhage": "retinal hemorajiler",
    "hard_exudates": "sert eksüdalar",
    "cotton_wool_spots": "yumuşak eksüdalar (CWS)",
    "irma": "IRMA bulguları",
    "venous_beading": "venöz beading",
    "neovascularization": "neovaskülarizasyon (NVE/NVD şüphesi)",
    "macular_edema_suspected": "maküler ödem şüphesi (fundus)",
    "cataract_effect": "katarakt veya görüntü kalitesi etkisi",
}

_DR_STAGE_SUMMARY_TR = [
    "Şu an için belirgin diyabetik retinopati bulgusu model tarafından saptanmadı; düşük riskli triyaj.",
    "Hafif düzeyde diyabetik retinopati (NPDR) ile uyumlu bulgular.",
    "Orta düzeyde diyabetik retinopati (NPDR) ile uyumlu bulgular.",
    "Şiddetli düzeyde diyabetik retinopati (NPDR) ile uyumlu bulgular; yakın retina uzmanı değerlendirmesi önemlidir.",
    "Proliferatif diyabetik retinopati veya gelişmiş neovasküler risk ile uyumlu bulgular; acil/öncelikli değerlendirme önerilir.",
]


def _active_finding_phrases(findings: dict[str, bool]) -> list[str]:
    out: list[str] = []
    for k in FUNDUS_FINDING_KEYS:
        if findings.get(k):
            p = _FINDING_PHRASE_TR.get(k)
            if p:
                out.append(p)
    return out


def build_clinical_reasoning_tr(
    dr_idx: int,
    findings: dict[str, bool],
    dme_suspected: bool,
) -> str:
    dr_idx = max(0, min(4, dr_idx))
    stage_line = _DR_STAGE_SUMMARY_TR[dr_idx]
    phrases = _active_finding_phrases(findings)
    if phrases:
        finding_sentence = (
            "Fundusta " + ", ".join(phrases) + " dikkati çekmektedir. "
        )
    else:
        finding_sentence = (
            "Fundus üzerinde model tarafından vurgulanan spesifik bulgu seti sınırlıdır. "
        )
    if dme_suspected:
        dme_sentence = (
            "Diyabetik maküler ödem (DME) açısından şüpheli sinyaller mevcuttur; OCT ile doğrulama önerilir. "
        )
    else:
        dme_sentence = ""
    closing = (
        "Bu metin yerel görüntü modeli ve triyaj şablonları ile üretilmiştir; "
        "kesin evreleme ve tedavi kararı için retina uzmanı değerlendirmesi gereklidir."
    )
    return f"{stage_line} {finding_sentence}{dme_sentence}{closing}"


def build_uncertainty_note_tr() -> str:
    return (
        "Tek bir fundus görüntüsü ile kesin evreleme ve tüm klinik senaryoların değerlendirilmesi sınırlıdır. "
        "OCT, görme alanı ve sistemik verilerle desteklenmesi ve retina uzmanı tarafından doğrulanması önerilir."
    )


def build_clinical_decision_rich_tr(
    dr_idx: int,
    findings: dict[str, bool],
    dme_prob: float,
) -> dict[str, Any]:
    neo = findings.get("neovascularization", False)
    referable = dr_idx >= 2 or neo or dme_prob >= 0.5
    if neo or dr_idx >= 4:
        urgency = "emergency"
    elif referable:
        urgency = "urgent"
    else:
        urgency = "routine"

    actions: list[str] = []
    if referable:
        actions.append(
            "Diyabetik retinopati ve makula riski açısından ileri tetkik ve tedavi için göz hastalıkları uzmanına sevk önerilir."
        )
    if dme_prob >= 0.5:
        actions.append("DME şüphesi için OCT ile makula değerlendirmesi önerilir.")
    if dr_idx >= 1:
        actions.append(
            "Kan şekeri (HbA1c) ve kan basıncı kontrolü ile sistemik optimizasyon önerilir."
        )
    if not actions:
        actions.append("Rutin diyabetik göz taraması ve periyodik takip önerilir.")

    if neo or dr_idx >= 4:
        follow = (
            "Acil/öncelikli retina konsültasyonu; proliferatif bulgu şüphesi nedeniyle gecikmeden değerlendirme."
        )
    elif referable:
        follow = "Yaklaşık 3 ay içinde retina uzmanı kontrolü önerilir (triyaja göre önceliklendirilebilir)."
    else:
        follow = "12 ay içinde tekrar diyabetik retinopati taraması önerilir veya hekiminizin belirlediği aralık."

    return {
        "referableDr": referable,
        "urgency": urgency,
        "recommendedActions": actions,
        "followUpTr": follow,
    }


def build_odir_results_dme(
    dme_suspected: bool, dme_confidence: float
) -> list[dict[str, Any]]:
    odir_results: list[dict[str, Any]] = []
    if dme_suspected:
        cap = min(float(dme_confidence), 0.55)
        odir_results.append(
            {
                "label": "DME (diyabetik maküler ödem şüphesi)",
                "confidence": cap,
                "note": "Triyaj; OCT ile doğrulanmalı",
            }
        )
    if not odir_results:
        odir_results.append({"label": "Ek risk raporu yok", "confidence": 0.0})
    return odir_results


def build_inference_meta_local(
    model_name: str, prompt_version: str = "local_templates_v1"
) -> dict[str, Any]:
    return {
        "backend": "local_multitask",
        "model": model_name,
        "promptVersion": prompt_version,
        "note": (
            "Yerel cok gorevli model + Turkce sablon; Gemini ile ayni JSON anahtarlari. "
            "Klinik karar yerine gecmez."
        ),
    }


def english_dr_label(dr_idx: int) -> str:
    dr_idx = max(0, min(4, dr_idx))
    return DR_GRADE_LABELS_EN_SHORT[dr_idx]
