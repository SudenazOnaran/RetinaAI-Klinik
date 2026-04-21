import type { Locale } from "@/lib/i18n/config";
import { formatDrLabelForDisplay } from "@/lib/dr-stage-labels";

/** @deprecated Yerine doğrudan `formatDrLabelForDisplay` kullanın; geriye dönük uyumluluk için bırakıldı. */
export function drLabelTr(
  value?: string | null,
  locale: Locale = "tr",
): string {
  return formatDrLabelForDisplay(value, locale);
}
