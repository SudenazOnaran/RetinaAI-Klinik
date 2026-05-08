import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A reusable surface-layering container.
///
/// Follows the design system hierarchy:
/// - Background: surface
/// - Sections: surface-container-low
/// - Cards: surface-container-lowest
///
/// Uses soft ambient shadows and large rounded corners. No borders.
class SectionContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final Color? color;
  final List<BoxShadow>? boxShadow;
  final double? width;
  final double? height;

  const SectionContainer({
    Key? key,
    required this.child,
    this.padding,
    this.borderRadius = 20,
    this.color,
    this.boxShadow,
    this.width,
    this.height,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: padding ?? const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color ?? AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow:
            boxShadow ??
            [
              BoxShadow(
                blurRadius: 30,
                color: AppColors.secondary.withOpacity(0.05),
                offset: const Offset(0, 8),
              ),
            ],
      ),
      child: child,
    );
  }
}
