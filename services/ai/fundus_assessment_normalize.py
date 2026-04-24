"""
Fundus degerlendirmesi: doktor/LLM ile uyumlu yapilandirilmis cikti (egitim + triyaj).
Gemini prompt + yerel multitask ciktilari bu semaya normalize edilir.
"""
from __future__ import annotations

from typing import Any

FUNDUS_ASSESSMENT_SCHEMA_VERSION = "fundus_assessment_v1"

_PRESENCE = frozenset({"absent", "present", "uncertain"})
_BURDEN = frozenset({"sparse", "widespread", "unspecified"})
_PATTERN = frozenset({"local", "widespread", "unspecified"})
_GLOBAL_PATTERN = frozenset({"focal_sparse", "widespread", "mixed", "unspecified"})


def _presence(v: object) -> str:
    if isinstance(v, str) and v.strip().lower() in _PRESENCE:
        return v.strip().lower()
    if isinstance(v, bool):
        return "present" if v else "absent"
    return "uncertain"


def _opt_bool(v: object) -> bool | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("true", "1", "yes", "evet"):
            return True
        if s in ("false", "0", "no", "hayir"):
            return False
    return None


def _opt_int_0_4(v: object) -> int | None:
    if v is None:
        return None
    try:
        i = int(v)
    except (TypeError, ValueError):
        return None
    if 0 <= i <= 4:
        return i
    return None


def _burden(v: object) -> str:
    if isinstance(v, str) and v.strip().lower() in _BURDEN:
        return v.strip().lower()
    return "unspecified"


def _pattern(v: object) -> str:
    if isinstance(v, str) and v.strip().lower() in _PATTERN:
        return v.strip().lower()
    return "unspecified"


def _global_pattern(v: object) -> str:
    if isinstance(v, str) and v.strip().lower() in _GLOBAL_PATTERN:
        return v.strip().lower()
    return "unspecified"


def _str_clip(v: object, n: int) -> str:
    s = str(v or "").strip()
    return s[:n] if s else ""


def _subdict(raw: object) -> dict[str, Any]:
    return raw if isinstance(raw, dict) else {}


def default_fundus_assessment() -> dict[str, Any]:
    """Model ciktisi eksikse doldurulacak sablon (fundustan kesin dislananlar sabit metin)."""
    na = {
        "glaucoma": {
            "assessable": False,
            "reason_tr": (
                "Fundus tek basina glokom icin yeterli degildir; C/D orani tek basina "
                "tanisal degildir. OCT (RNFL), gorme alani ve pakimetri gerekir."
            ),
        },
        "amd_definitive": {
            "assessable": False,
            "reason_tr": (
                "Kesin AMD tanisi fundus fotografi ile konulamaz; drusen olabilir ancak "
                "ayirici tanı ve evreleme icin multimodal goruntuleme onerilir."
            ),
        },
        "hypertensive_retinopathy_definitive": {
            "assessable": False,
            "reason_tr": (
                "Hipertansif retinopati fundusta sinirli ipuclari verebilir; kesin siniflama "
                "icin klinik korelasyon ve gerekirse ek tetkik gerekir."
            ),
        },
    }
    return {
        "schema_version": FUNDUS_ASSESSMENT_SCHEMA_VERSION,
        "microaneurysm": {
            "presence": "uncertain",
            "burden": "unspecified",
            "notes_tr": "",
        },
        "hemorrhage": {
            "presence": "uncertain",
            "quadrants_affected": None,
            "burden": "unspecified",
            "notes_tr": "",
        },
        "hard_exudates": {
            "presence": "uncertain",
            "near_macula": None,
            "widespread": None,
            "notes_tr": "",
        },
        "cotton_wool_spots": {
            "presence": "uncertain",
            "notes_tr": "",
        },
        "venous_beading": {
            "presence": "uncertain",
            "notes_tr": "",
        },
        "irma": {
            "presence": "uncertain",
            "notes_tr": "",
        },
        "neovascularization": {
            "presence": "uncertain",
            "nvd": None,
            "nve": None,
            "notes_tr": "",
        },
        "quadrant_distribution": {
            "hemorrhage_quadrant_count": None,
            "pattern": "unspecified",
            "notes_tr": "",
        },
        "rule_4_2_1": {
            "hemorrhage_four_quadrants": None,
            "venous_beading_two_quadrants": None,
            "irma_one_quadrant": None,
            "implies_severe_npdr_if_any": None,
            "notes_tr": "",
        },
        "macula": {
            "hard_exudates_near_macula": None,
            "edema_suspected_clinical": None,
            "affects_treatment_decision": None,
            "notes_tr": "",
        },
        "dme_indirect": {
            "inferred_from_fundus": None,
            "rationale_tr": "",
            "critical_finding": None,
        },
        "lesion_severity": {
            "overall_pattern": "unspecified",
            "notes_tr": "",
        },
        "not_assessable_from_fundus": na,
    }


def normalize_fundus_assessment(raw: object) -> dict[str, Any]:
    """Gemini/JSON ciktisini sablona oturtur; bilinmeyen alanlari varsayilanla doldurur."""
    base = default_fundus_assessment()
    if not isinstance(raw, dict):
        return base

    def merge_lesion(key: str) -> None:
        b = base[key]
        s = _subdict(raw.get(key))
        b["presence"] = _presence(s.get("presence"))
        if "burden" in b:
            b["burden"] = _burden(s.get("burden"))
        if "quadrants_affected" in b:
            b["quadrants_affected"] = _opt_int_0_4(s.get("quadrants_affected"))
        if "near_macula" in b:
            b["near_macula"] = _opt_bool(s.get("near_macula"))
        if "widespread" in b:
            b["widespread"] = _opt_bool(s.get("widespread"))
        if "nvd" in b:
            b["nvd"] = _opt_bool(s.get("nvd"))
        if "nve" in b:
            b["nve"] = _opt_bool(s.get("nve"))
        nt = _str_clip(s.get("notes_tr"), 2000)
        if nt:
            b["notes_tr"] = nt

    merge_lesion("microaneurysm")
    merge_lesion("hemorrhage")
    merge_lesion("hard_exudates")
    merge_lesion("cotton_wool_spots")
    merge_lesion("venous_beading")
    merge_lesion("irma")
    merge_lesion("neovascularization")

    qd = _subdict(raw.get("quadrant_distribution"))
    base["quadrant_distribution"]["hemorrhage_quadrant_count"] = _opt_int_0_4(
        qd.get("hemorrhage_quadrant_count")
    )
    base["quadrant_distribution"]["pattern"] = _pattern(qd.get("pattern"))
    nt = _str_clip(qd.get("notes_tr"), 2000)
    if nt:
        base["quadrant_distribution"]["notes_tr"] = nt

    r421 = _subdict(raw.get("rule_4_2_1"))
    base["rule_4_2_1"]["hemorrhage_four_quadrants"] = _opt_bool(
        r421.get("hemorrhage_four_quadrants")
    )
    base["rule_4_2_1"]["venous_beading_two_quadrants"] = _opt_bool(
        r421.get("venous_beading_two_quadrants")
    )
    base["rule_4_2_1"]["irma_one_quadrant"] = _opt_bool(r421.get("irma_one_quadrant"))
    base["rule_4_2_1"]["implies_severe_npdr_if_any"] = _opt_bool(
        r421.get("implies_severe_npdr_if_any")
    )
    nt = _str_clip(r421.get("notes_tr"), 2000)
    if nt:
        base["rule_4_2_1"]["notes_tr"] = nt

    mac = _subdict(raw.get("macula"))
    base["macula"]["hard_exudates_near_macula"] = _opt_bool(
        mac.get("hard_exudates_near_macula")
    )
    base["macula"]["edema_suspected_clinical"] = _opt_bool(
        mac.get("edema_suspected_clinical")
    )
    base["macula"]["affects_treatment_decision"] = _opt_bool(
        mac.get("affects_treatment_decision")
    )
    nt = _str_clip(mac.get("notes_tr"), 2000)
    if nt:
        base["macula"]["notes_tr"] = nt

    dme_i = _subdict(raw.get("dme_indirect"))
    base["dme_indirect"]["inferred_from_fundus"] = _opt_bool(
        dme_i.get("inferred_from_fundus")
    )
    rt = _str_clip(dme_i.get("rationale_tr"), 4000)
    if rt:
        base["dme_indirect"]["rationale_tr"] = rt
    base["dme_indirect"]["critical_finding"] = _opt_bool(dme_i.get("critical_finding"))

    ls = _subdict(raw.get("lesion_severity"))
    base["lesion_severity"]["overall_pattern"] = _global_pattern(ls.get("overall_pattern"))
    nt = _str_clip(ls.get("notes_tr"), 2000)
    if nt:
        base["lesion_severity"]["notes_tr"] = nt

    naf = _subdict(raw.get("not_assessable_from_fundus"))
    for sub in ("glaucoma", "amd_definitive", "hypertensive_retinopathy_definitive"):
        block = _subdict(naf.get(sub))
        if block.get("assessable") is True:
            base["not_assessable_from_fundus"][sub]["assessable"] = False
        r = _str_clip(block.get("reason_tr"), 2000)
        if r:
            base["not_assessable_from_fundus"][sub]["reason_tr"] = r

    base["schema_version"] = FUNDUS_ASSESSMENT_SCHEMA_VERSION
    return base


def fundus_assessment_from_boolean_map(
    findings: dict[str, bool],
    *,
    dme_suspected: bool,
    dr_idx: int,
) -> dict[str, Any]:
    """
    Yerel CNN ciktisindan sezgisel fundus_assessment (ayrinti sinirli).
    """
    out = default_fundus_assessment()

    def pres(k: str) -> str:
        return "present" if findings.get(k) else "absent"

    out["microaneurysm"]["presence"] = pres("microaneurysm")
    out["microaneurysm"]["burden"] = (
        "unspecified" if not findings.get("microaneurysm") else "sparse"
    )
    out["hemorrhage"]["presence"] = pres("hemorrhage")
    out["hard_exudates"]["presence"] = pres("hard_exudates")
    out["hard_exudates"]["near_macula"] = findings.get("hard_exudates")
    out["cotton_wool_spots"]["presence"] = pres("cotton_wool_spots")
    out["venous_beading"]["presence"] = pres("venous_beading")
    out["irma"]["presence"] = pres("irma")
    nv = findings.get("neovascularization", False)
    out["neovascularization"]["presence"] = "present" if nv else "absent"
    out["neovascularization"]["nvd"] = None
    out["neovascularization"]["nve"] = None if not nv else True
    out["macula"]["edema_suspected_clinical"] = dme_suspected
    out["macula"]["hard_exudates_near_macula"] = findings.get("hard_exudates")
    out["dme_indirect"]["inferred_from_fundus"] = dme_suspected
    out["dme_indirect"]["critical_finding"] = dme_suspected and dr_idx >= 2
    if dr_idx >= 3:
        out["lesion_severity"]["overall_pattern"] = "widespread"
    elif dr_idx >= 1:
        out["lesion_severity"]["overall_pattern"] = "focal_sparse"
    out["rule_4_2_1"]["notes_tr"] = (
        "Yerel model: 4-2-1 kurali tek fundus goruntusunden otomatik sayilmadi; "
        "klinik dogrulama onerilir."
    )
    return out
