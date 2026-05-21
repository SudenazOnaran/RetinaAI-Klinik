import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hesap ve veri silme | Retina AI",
  description:
    "Retina AI mobil uygulamasında hesabınızı ve ilişkili verilerinizi nasıl silebileceğinizi açıklar.",
};

export default function HesapSilmePage() {
  return (
    <div className="clinic-app-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="clinic-panel rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Hesap ve ilişkili verilerin silinmesi
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Retina AI mobil uygulamasında oturum açtıktan sonra{" "}
            <strong>Profil</strong> sekmesinden hesabınızı kalıcı olarak
            silebilirsiniz. Bu işlem geri alınamaz; hesabınız, profil bilgileriniz
            ve hesabınıza bağlı hasta ile analiz kayıtları sistemden silinir.
          </p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            Uygulama içi adımlar
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Retina AI uygulamasını açın ve hesabınızla giriş yapın.</li>
            <li>Alt menüden <strong>Profil</strong> ekranına gidin.</li>
            <li>
              <strong>“Hesabımı ve verilerimi sil”</strong> seçeneğine dokunun.
            </li>
            <li>
              Uyarıyı okuyup onaylayın. İşlem tamamlandığında oturumunuz kapanır.
            </li>
          </ol>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            Ek bilgi veya sorular
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            KVKK kapsamındaki diğer talepleriniz için{" "}
            <a
              className="font-medium text-[var(--retina-primary)] underline underline-offset-2"
              href="mailto:destek@retina-ai.tech"
            >
              destek@retina-ai.tech
            </a>{" "}
            adresine yazabilirsiniz.
          </p>

          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex rounded-lg bg-[var(--retina-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--retina-primary-deep)]"
            >
              Web girişine dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
