/** AI Flask (app_gemini) ile uyumlu goruntu yukleme adi ve dogrulama. */

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/bmp": ".bmp",
  "image/webp": ".webp",
  "image/tiff": ".tif",
};

const ALLOWED_EXT_PATTERN = /\.(jpe?g|png|bmp|webp|tiff?)$/i;

const ALLOWED_EXT_LIST = ["jpg", "jpeg", "png", "bmp", "webp", "tif", "tiff"];

export type AiImageValidationResult =
  | { ok: true }
  | { ok: false; displayExt: string | null };

export function fileExtensionLabel(file: File): string | null {
  const name = (file.name || "").trim();
  if (!name.includes(".")) return null;
  const ext = name.split(".").pop()?.toLowerCase();
  return ext || null;
}

export function validateAiImageFile(file: File): AiImageValidationResult {
  const name = (file.name || "").trim();
  if (name && ALLOWED_EXT_PATTERN.test(name)) {
    return { ok: true };
  }
  const mime = (file.type || "").trim().toLowerCase();
  if (mime && EXT_BY_MIME[mime]) {
    return { ok: true };
  }
  return { ok: false, displayExt: fileExtensionLabel(file) };
}

export function resolveAiUploadFilename(file: File, fallbackStem: string): string {
  const raw = (file.name || "").trim();
  if (raw && ALLOWED_EXT_PATTERN.test(raw)) return raw;
  const mime = (file.type || "").trim().toLowerCase();
  const ext = EXT_BY_MIME[mime] || ".jpg";
  return `${fallbackStem}${ext}`;
}

export function fileWithAiUploadName(file: File, fallbackStem: string): File {
  const name = resolveAiUploadFilename(file, fallbackStem);
  if (file.name === name) return file;
  return new File([file], name, { type: file.type || "image/jpeg" });
}

export function allowedFormatsListForUi(): string {
  return ALLOWED_EXT_LIST.map((e) => e.toUpperCase()).join(", ");
}

type TranslateFn = (
  key: string,
  options?: Record<string, string | number>,
) => string;

/** Secim aninda veya sunucu 400 yanitinda gosterilecek metin. */
export function formatUnsupportedImageMessage(
  t: TranslateFn,
  displayExt?: string | null,
): string {
  if (displayExt) {
    return t("analysisCard.unsupportedImageFormatWithExt", {
      ext: displayExt,
      formats: allowedFormatsListForUi(),
    });
  }
  return t("analysisCard.unsupportedImageFormat", {
    formats: allowedFormatsListForUi(),
  });
}

export function isFormatRelatedAiError(raw: string): boolean {
  const low = (raw || "").trim().toLowerCase();
  return (
    low.includes("unsupported_image_format") ||
    low.includes("sadece jpg") ||
    low.includes("formatlari kabul") ||
    low.includes("gecersiz dosya tipi") ||
    low.includes("geçersiz dosya")
  );
}

/** Flask / gateway hata metnini kullanici diline cevir. */
export function humanizeAiImageUploadError(raw: string, t: TranslateFn): string {
  const s = (raw || "").trim();
  if (!s) return t("analysisCard.serviceUnavailableRetry");
  const low = s.toLowerCase();
  if (
    low.includes("unsupported_image_format") ||
    low.includes("sadece jpg") ||
    low.includes("formatlari kabul") ||
    low.includes("desteklenmiyor") ||
    low.includes("gecersiz dosya tipi") ||
    low.includes("geçersiz dosya") ||
    low.includes("unsupported") ||
    low.includes("not a valid image")
  ) {
    const extFromMsg = s.match(/\.([a-z0-9]{1,8})\b/i)?.[1] ?? null;
    return formatUnsupportedImageMessage(t, extFromMsg);
  }
  if (low.includes("bos dosya")) {
    return t("analysisCard.emptyImageFile");
  }
  if (low.includes("boyutu limiti")) {
    return t("analysisCard.imageTooLarge");
  }
  if (low.includes("gecerli bir gorsel degil")) {
    return t("analysisCard.invalidImageFile");
  }
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
}
