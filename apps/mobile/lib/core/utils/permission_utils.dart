import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

/// Kamera ve galeri izin yönetimi yardımcı sınıfı.
class PermissionUtils {
  PermissionUtils._();

  /// Kamera iznini ister. Reddedilirse ayarlar ekranına yönlendirir.
  static Future<bool> requestCameraPermission(BuildContext context) async {
    final status = await Permission.camera.request();
    if (status.isGranted) return true;

    if (status.isPermanentlyDenied && context.mounted) {
      await _showSettingsDialog(
        context,
        title: 'Kamera İzni Gerekli',
        message:
            'AI analizi için kameraya erişim gereklidir. Lütfen uygulama ayarlarından kamera iznini etkinleştirin.',
      );
    }
    return false;
  }

  /// Galeri seçimi Android Photo Picker ile yapılır; geniş depolama izni istenmez.
  static Future<bool> requestGalleryPermission(BuildContext context) async {
    return true;
  }

  static Future<void> _showSettingsDialog(
    BuildContext context, {
    required String title,
    required String message,
  }) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('İptal'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              openAppSettings();
            },
            child: const Text('Ayarları Aç'),
          ),
        ],
      ),
    );
  }
}
