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

  /// Galeri/medya iznini ister. Reddedilirse ayarlar ekranına yönlendirir.
  static Future<bool> requestGalleryPermission(BuildContext context) async {
    // Android 13+ için READ_MEDIA_IMAGES, daha eski için READ_EXTERNAL_STORAGE
    final Permission permission = Permission.photos;
    final status = await permission.request();
    if (status.isGranted || status.isLimited) return true;

    if (status.isPermanentlyDenied && context.mounted) {
      await _showSettingsDialog(
        context,
        title: 'Galeri İzni Gerekli',
        message:
            'Fotoğraf seçmek için galeri erişimi gereklidir. Lütfen uygulama ayarlarından izni etkinleştirin.',
      );
    }
    return false;
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
