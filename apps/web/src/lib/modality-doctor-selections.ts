/**
 * `Analysis.modalityDoctorSelectionsJson` — gelecekte migration ile bağlanacak yapı.
 * Şimdilik null kalır; `ffa_json:v3` ve saklı geri bildirim ile paralel taşıma için ana şema burada dokümante edilir.
 */

/** Tek semantic versiyon; dataset kolonları eklendiğinde artırılır. */
export const MODALITY_DOCTOR_SELECTIONS_SCHEMA_VERSION = 1 as const;

/**
 * Örnek (FFA çoklu + OCT kodları):
 * {
 *   "schemaVersion": 1,
 *   "ffa": { "codes": ["ffa_dr", "ffa_csr"], "drStageStorage": "hafif NPDR" },
 *   "oct": { "codes": ["oct_dme"] }
 * }
 */
export type ModalityDoctorSelectionsV1 = {
  schemaVersion: typeof MODALITY_DOCTOR_SELECTIONS_SCHEMA_VERSION;
  ffa?: {
    codes: string[];
    drStageStorage?: string | null;
  };
  oct?: {
    codes: string[];
  };
};

export type ModalityDoctorSelectionsStored = ModalityDoctorSelectionsV1;
