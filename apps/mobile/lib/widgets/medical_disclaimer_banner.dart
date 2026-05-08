import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Sonuç ve analiz ekranlarında gösterilen kalıcı tıbbi sorumluluk reddi.
class MedicalDisclaimerBanner extends StatelessWidget {
  const MedicalDisclaimerBanner({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 18, color: Color(0xFF64748B)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Bu analiz yalnızca sağlık profesyonellerine yönelik destekleyici bir araçtır '
              've kesin tıbbi tanı yerine geçmez. Klinik karar almak için '
              'mutlaka yetkili bir hekim görüşü alınız.',
              style: GoogleFonts.inter(
                fontSize: 11,
                color: const Color(0xFF475569),
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
