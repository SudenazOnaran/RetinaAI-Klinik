import { drLabelTr } from "@/lib/dr-label-tr";
import {
  decodeModalityAiAlignedLabel,
  isDoctorApprovalToken,
} from "@/lib/doctor-feedback";
import { tryParseFfaDoctorFeedbackAny } from "@/lib/ffa-doctor-feedback-json";

/** modalityDisagree.ffa.* ile uyumlu kısa etiketler (liste özeti için). */
const FFA_DX_TR: Record<string, string> = {
  ffa_healthy: "Sağlıklı / belirgin patoloji yok",
  ffa_dr: "Diyabetik retinopati (DR)",
  ffa_rvo: "Retinal ven tıkanıklığı (RVO)",
  ffa_amd_cnv: "AMD (koroidal neovaskülarizasyon · CNV)",
  ffa_csr: "Santral seröz koryoretinopati (CSR)",
  ffa_uveitis: "Üveit / retinal vaskülit",
};

const FFA_DX_EN: Record<string, string> = {
  ffa_healthy: "Healthy / no significant angiographic abnormality",
  ffa_dr: "Diabetic retinopathy (DR)",
  ffa_rvo: "Retinal vein occlusion (RVO)",
  ffa_amd_cnv: "AMD (choroidal neovascularization · CNV)",
  ffa_csr: "Central serous chorioretinopathy (CSR)",
  ffa_uveitis: "Uveitis / retinal vasculitis",
};

/**
 * `ffa_json:{...}` veya ham DR etiketini hasta listesi / triaj özetinde gösterilebilir metne çevirir.
 */
export function humanizeFfaDoctorFeedbackForSummary(
  raw: string,
  locale: "tr" | "en" = "tr",
): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "null") return "";
  const maiDec = decodeModalityAiAlignedLabel(s);
  if (maiDec) return maiDec;
  if (isDoctorApprovalToken(s)) {
    return locale === "tr" ? "AI ile uyumlu" : "Aligned with AI";
  }

  const parsedAny = tryParseFfaDoctorFeedbackAny(s);
  if (parsedAny?.v === 3) {
    const map = locale === "en" ? FFA_DX_EN : FFA_DX_TR;
    const parts = parsedAny.diagnoses.map(
      (code: string) =>
        map[code] ??
        (locale === "en" ? code : code.replace(/_/g, " ")),
    );
    let out = parts.join(locale === "tr" ? " · " : "; ");
    if (parsedAny.diagnoses.includes("ffa_dr")) {
      const st = String(parsedAny.drStage ?? "").trim();
      const nvParts: string[] = [];
      if (parsedAny.nvd === true) nvParts.push("NVD+");
      if (parsedAny.nve === true) nvParts.push("NVE+");
      if (st) {
        const stagePretty = drLabelTr(st);
        out +=
          locale === "tr"
            ? ` — DR evresi: ${stagePretty}${nvParts.length ? ` (${nvParts.join(" · ")})` : ""}`
            : ` — DR stage: ${stagePretty}${nvParts.length ? ` (${nvParts.join(", ")})` : ""}`;
      } else if (nvParts.length) {
        out += locale === "tr" ? ` — ${nvParts.join(" · ")}` : ` — ${nvParts.join(", ")}`;
      }
    }
    return out;
  }

  const parsed = parsedAny?.v === 2 ? parsedAny : null;
  if (parsed) {
    const map = locale === "en" ? FFA_DX_EN : FFA_DX_TR;
    const dx =
      map[parsed.diagnosis] ??
      (locale === "en" ? parsed.diagnosis : parsed.diagnosis.replace(/_/g, " "));
    if (parsed.diagnosis === "ffa_dr") {
      const st = String(parsed.drStage ?? "").trim();
      const nvParts: string[] = [];
      if (parsed.nvd === true) nvParts.push("NVD+");
      if (parsed.nve === true) nvParts.push("NVE+");
      if (st) {
        const stagePretty = drLabelTr(st);
        return locale === "tr"
          ? `${dx} — Evre: ${stagePretty}${nvParts.length ? ` (${nvParts.join(" · ")})` : ""}`
          : `${dx} — Stage: ${stagePretty}${nvParts.length ? ` (${nvParts.join(", ")})` : ""}`;
      }
      return locale === "tr"
        ? `${dx}${nvParts.length ? ` (${nvParts.join(" · ")})` : ""} (evre seçimi bekleniyor)`
        : `${dx}${nvParts.length ? ` (${nvParts.join(", ")})` : ""} (stage pending)`;
    }
    return dx;
  }

  if (s.length > 96) return `${s.slice(0, 93)}…`;
  return drLabelTr(s);
}

const FFA_JSON_SNIP = "ffa_json:";

/**
 * `Patient.risk` veya birleşik özet metin içinde gömülü `ffa_json:{...}` parçalarını
 * okunaklı etikete çevirir (ham JSON kalmasın).
 */
export function humanizeEmbeddedFfaJsonInText(
  text: string,
  locale: "tr" | "en" = "tr",
): string {
  const t = String(text ?? "");
  if (!t.includes(FFA_JSON_SNIP)) return t;

  let out = "";
  let cursor = 0;
  while (cursor < t.length) {
    const idx = t.indexOf(FFA_JSON_SNIP, cursor);
    if (idx === -1) {
      out += t.slice(cursor);
      break;
    }
    out += t.slice(cursor, idx);
    let pos = idx + FFA_JSON_SNIP.length;
    while (pos < t.length && /\s/.test(t[pos]!)) pos++;
    if (t[pos] !== "{") {
      out += FFA_JSON_SNIP;
      cursor = idx + FFA_JSON_SNIP.length;
      continue;
    }
    let depth = 0;
    const startParse = pos;
    for (; pos < t.length; pos++) {
      const ch = t[pos]!;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          pos++;
          break;
        }
      }
    }
    const rawFull = t.slice(idx, pos);
    out += humanizeFfaDoctorFeedbackForSummary(rawFull, locale);
    cursor = pos;
  }
  return out;
}
