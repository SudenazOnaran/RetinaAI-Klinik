import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// A single day cell for the calendar grid.
///
/// Active state uses primary fill with white text.
/// Inactive days use subtle surface color. No borders.
class CalendarDayItem extends StatelessWidget {
  final int day;
  final bool isActive;
  final bool hasEvent;
  final VoidCallback? onTap;

  const CalendarDayItem({
    Key? key,
    required this.day,
    this.isActive = false,
    this.hasEvent = false,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isActive
              ? AppColors.primary
              : hasEvent
              ? AppColors.primaryContainer.withOpacity(0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$day',
                style: GoogleFonts.manrope(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: isActive ? Colors.white : AppColors.onSurface,
                ),
              ),
              if (hasEvent && !isActive) ...[
                const SizedBox(height: 2),
                Container(
                  width: 4,
                  height: 4,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
