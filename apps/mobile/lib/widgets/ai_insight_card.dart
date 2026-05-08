import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

class AiInsightCard extends StatelessWidget {
  final String title;
  final String insight;
  final String? imagePath;
  final Widget? imageWidget;

  const AiInsightCard({
    Key? key,
    required this.title,
    required this.insight,
    this.imagePath,
    this.imageWidget,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            blurRadius: 30,
            color: AppColors.secondary.withOpacity(0.06),
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.manrope(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  insight,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.secondary,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          if (imageWidget != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              child: imageWidget,
            )
          else if (imagePath != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              width: double.infinity,
              height: 200,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
              ),
              child: Image.asset(
                imagePath!,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              margin: const EdgeInsets.only(top: 8),
              width: double.infinity,
              height: 200,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
              ),
              child: Center(
                child: Icon(
                  Icons.image,
                  size: 48,
                  color: AppColors.outline,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
