import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:retina_ai_app/core/providers/auth_provider.dart';
import 'package:retina_ai_app/core/providers/sync_provider.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _doctorNotes = true;
  bool _heatmap = true;
  bool _automaticPDF = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: Icon(Icons.visibility_outlined, color: Color(0xFF00687a)),
        title: Text(
          'RETINA KLİNİK',
          style: GoogleFonts.manrope(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF00687a),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              backgroundColor: Color(0xFF00687a),
              child: Icon(Icons.person, color: Colors.white, size: 20),
            ),
          ),
        ],
        backgroundColor: Colors.white,
        elevation: 1,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Text(
                        'Sistem Ayarları',
                        style: GoogleFonts.manrope(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Colors.black,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Klinik parametrelerini ve AI analiz tercihlerini buradan yönetin.',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w400,
                          color: Colors.grey[600],
                        ),
                      ),
                      SizedBox(height: 32),

                      // Clinic Information Section
                      _buildSectionTitle('Klinik Bilgileri'),
                      SizedBox(height: 12),
                      Container(
                        padding: EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Color(0xFFF5F7FA),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[200]!),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildInfoField(
                              'KLİNİK ADI',
                              'Merkez Retina Göz Sağlığı',
                            ),
                            SizedBox(height: 12),
                            _buildInfoField('LİSANS NUMARASI', 'RK-2024-8831'),
                            SizedBox(height: 12),
                            _buildInfoField(
                              'RESMİ ADRES',
                              'Levent Mahallesi, Aydın Sokak No:12, Beşiktaş, İstanbul',
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 32),

                      // Dil Ayarları
                      _buildSectionTitle('Dil Ayarları'),
                      SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              padding: EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Color(0xFFF5F7FA),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.language_outlined,
                                    size: 20,
                                    color: Color(0xFF00687a),
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Gece Modu',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: Container(
                              padding: EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Color(0xFFF5F7FA),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(
                                    Icons.dark_mode_outlined,
                                    size: 20,
                                    color: Color(0xFF00687a),
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Gece Modu',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 32),

                      // Raporlama Tercihleri
                      _buildSectionTitle('Raporlama Tercihleri'),
                      SizedBox(height: 12),
                      _buildToggleTile(
                        title: 'Doktor Notları',
                        subtitle: 'Rapor çıktısında manuel notları ekle',
                        value: _doctorNotes,
                        onChanged: (value) =>
                            setState(() => _doctorNotes = value),
                      ),
                      _buildToggleTile(
                        title: 'Isı Haritası (Heatmap)',
                        subtitle: 'AI lezyon tespit bölgelerini göster',
                        value: _heatmap,
                        onChanged: (value) => setState(() => _heatmap = value),
                      ),
                      _buildToggleTile(
                        title: 'Otomatik PDF Gönderimi',
                        subtitle: 'Analiz sonrası hastaya e-posta gönder',
                        value: _automaticPDF,
                        onChanged: (value) =>
                            setState(() => _automaticPDF = value),
                      ),
                      SizedBox(height: 32),

                      // Triage Settings
                      _buildSectionTitle('Triage ve Klinik Eşikler'),
                      SizedBox(height: 12),
                      Container(
                        padding: EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[200]!),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildTriageItem(
                              'Yüksek Risk Eşiği',
                              '85% üzeri',
                              Color(0xFFE53935),
                            ),
                            SizedBox(height: 16),
                            _buildTriageItem(
                              'Takip Önerisi Eşiği (DR)',
                              '40% üzeri',
                              Color(0xFF43A047),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 32),

                      // Storage Section
                      _buildSectionTitle('Depolama Durumu'),
                      SizedBox(height: 12),
                      Container(
                        padding: EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Color(0xFF00687a),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Depolama Durumu',
                              style: GoogleFonts.manrope(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                            SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: LinearProgressIndicator(
                                value: 0.6,
                                minHeight: 8,
                                backgroundColor: Colors.white.withOpacity(0.3),
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            ),
                            SizedBox(height: 8),
                            Text(
                              '1.2 TB / 2.0 TB kullanılıyor',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w400,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: 32),

                      // Ayarları Kaydet Button
                      ElevatedButton(
                        onPressed: () {},
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Color(0xFF00687a),
                          minimumSize: Size(double.infinity, 56),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: Text(
                          'Ayarları Kaydet',
                          style: GoogleFonts.manrope(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      SizedBox(height: 40),

                      // Senkronizasyon
                      _buildSectionTitle('Veri Senkronizasyonu'),
                      SizedBox(height: 12),
                      Consumer(
                        builder: (context, ref, _) {
                          final sync = ref.watch(syncProvider);
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (sync.lastSyncDate != null)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    'Son senkronizasyon: ${sync.lastSyncDate!.toLocal().toString().split('.').first}',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                ),
                              if (sync.unsyncedCount > 0)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    '${sync.unsyncedCount} kayıt senkronize edilmeyi bekliyor.',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: const Color(0xFFE64800),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ElevatedButton.icon(
                                onPressed: sync.isSyncing
                                    ? null
                                    : () => ref
                                          .read(syncProvider.notifier)
                                          .manualSync(),
                                icon: sync.isSyncing
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.sync_rounded),
                                label: Text(
                                  sync.isSyncing
                                      ? 'Senkronize Ediliyor...'
                                      : 'Şimdi Senkronize Et',
                                  style: GoogleFonts.manrope(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF00687a),
                                  minimumSize: const Size(double.infinity, 48),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      SizedBox(height: 24),

                      // Yasal
                      _buildSectionTitle('Yasal'),
                      _buildLegalTile(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Gizlilik Politikası',
                        onTap: () => launchUrl(
                          Uri.parse('https://retina-ai.tech/gizlilik'),
                          mode: LaunchMode.externalApplication,
                        ),
                      ),
                      _buildLegalTile(
                        icon: Icons.description_outlined,
                        title: 'Kullanım Koşulları',
                        onTap: () => launchUrl(
                          Uri.parse(
                            'https://retina-ai.tech/kullanim-kosullari',
                          ),
                          mode: LaunchMode.externalApplication,
                        ),
                      ),
                      SizedBox(height: 24),

                      // Çıkış Yap
                      OutlinedButton.icon(
                        onPressed: () async {
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Çıkış Yap'),
                              content: const Text(
                                'Oturumu kapatmak istediğinizden emin misiniz?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('İptal'),
                                ),
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text(
                                    'Çıkış Yap',
                                    style: TextStyle(color: Colors.red),
                                  ),
                                ),
                              ],
                            ),
                          );
                          if (confirm == true && mounted) {
                            await ref.read(authProvider.notifier).logout();
                            if (mounted) context.go('/signin');
                          }
                        },
                        icon: const Icon(
                          Icons.logout_rounded,
                          color: Colors.red,
                        ),
                        label: Text(
                          'Çıkış Yap',
                          style: GoogleFonts.manrope(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.red,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.red),
                          minimumSize: const Size(double.infinity, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                      SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      extendBody: true,
      bottomNavigationBar: const ClinicBottomNav(
        selectedTab: ClinicBottomTab.profile,
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: GoogleFonts.manrope(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: Color(0xFF00687a),
      ),
    );
  }

  Widget _buildLegalTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF00687A), size: 20),
        title: Text(
          title,
          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500),
        ),
        trailing: const Icon(Icons.open_in_new, size: 16, color: Colors.grey),
        onTap: onTap,
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _buildInfoField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.grey[600],
          ),
        ),
        SizedBox(height: 4),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Colors.black,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToggleTile({
    required String title,
    required String subtitle,
    required bool value,
    required Function(bool) onChanged,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.black,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: Color(0xFF00687a),
          ),
        ],
      ),
    );
  }

  Widget _buildTriageItem(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: Colors.grey[700],
          ),
        ),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: color),
          ),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              SizedBox(width: 6),
              Text(
                value,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
