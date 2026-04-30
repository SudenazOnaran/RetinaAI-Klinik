/**
 * Deprecated: training_snapshot_v2 alanlari doktor-only semaya gecisle kaldirildi.
 * Bu script geriye donuk olarak no-op bir bilgi mesaji verir.
 *   cd apps/web && npx tsx scripts/backfill-training-snapshot-v2.ts
 */
import "dotenv/config";

async function main() {
  console.log(
    JSON.stringify(
      {
        message: "backfill_training_snapshot_v2_skipped",
        reason:
          "training snapshot alanlari doktor-only egitim semasindan kaldirildi; islem gerekmiyor.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
