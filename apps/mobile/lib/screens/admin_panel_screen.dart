import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/constants/api_constants.dart';
import '../widgets/clinic_bottom_nav.dart';

/// Spec §10 — ADMIN role only.
/// Lists doctor registration requests with APPROVE / REJECT actions.
class AdminPanelScreen extends ConsumerStatefulWidget {
  const AdminPanelScreen({super.key});

  @override
  ConsumerState<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends ConsumerState<AdminPanelScreen> {
  List<Map<String, dynamic>> _requests = [];
  bool _isLoading = true;
  String _filter = 'PENDING';
  static const Color _primary = Color(0xFF00687A);

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final resp = await ApiClient.instance
          .get('${ApiConstants.adminRequests}?status=$_filter');
      final data = resp.data as Map<String, dynamic>;
      setState(() {
        _requests =
            List<Map<String, dynamic>>.from(data['data'] as List? ?? []);
      });
    } catch (_) {
      setState(() => _requests = []);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateRequest(String doctorId, String action) async {
    try {
      await ApiClient.instance.post(
        ApiConstants.adminRequests,
        data: {'doctorId': doctorId, 'action': action},
      );
      await _loadRequests();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (e.response?.data as Map?)?['error']?.toString() ?? 'Hata oluştu',
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F9FB),
        elevation: 0,
        title: Text(
          'Admin Panel',
          style: GoogleFonts.manrope(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF111827),
          ),
        ),
      ),
      body: Column(
        children: [
          _buildFilterChips(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _requests.isEmpty
                    ? Center(
                        child: Text(
                          'Kayıt bulunamadı.',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: const Color(0xFF6B7280),
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadRequests,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _requests.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 12),
                          itemBuilder: (_, i) =>
                              _RequestCard(
                            request: _requests[i],
                            onApprove: _filter == 'PENDING'
                                ? () => _updateRequest(
                                    _requests[i]['id']?.toString() ?? '',
                                    'APPROVE')
                                : null,
                            onReject: _filter == 'PENDING'
                                ? () => _updateRequest(
                                    _requests[i]['id']?.toString() ?? '',
                                    'REJECT')
                                : null,
                          ),
                        ),
                      ),
          ),
        ],
      ),
      bottomNavigationBar:
          const ClinicBottomNav(selectedTab: ClinicBottomTab.admin),
    );
  }

  Widget _buildFilterChips() {
    const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
    final labels = {
      'PENDING': 'Bekleyen',
      'APPROVED': 'Onaylı',
      'REJECTED': 'Reddedilen',
      'ALL': 'Tümü',
    };
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: statuses
              .map((s) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(labels[s]!),
                      selected: _filter == s,
                      onSelected: (_) {
                        setState(() => _filter = s);
                        _loadRequests();
                      },
                      selectedColor: _primary.withOpacity(0.15),
                      checkmarkColor: _primary,
                      labelStyle: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: _filter == s ? _primary : const Color(0xFF6B7280),
                      ),
                    ),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    this.onApprove,
    this.onReject,
  });

  final Map<String, dynamic> request;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;

  @override
  Widget build(BuildContext context) {
    final name = '${request['name'] ?? ''} ${request['surname'] ?? ''}'.trim();
    final email = request['email']?.toString() ?? '';
    final specialty = request['specialty']?.toString() ?? '';
    final hospital = request['hospital']?.toString() ?? '';
    final status = request['status']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                  ),
                ),
              ),
              _StatusBadge(status: status),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            email,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF6B7280),
            ),
          ),
          if (specialty.isNotEmpty || hospital.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              [specialty, hospital].where((s) => s.isNotEmpty).join(' • '),
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF9CA3AF),
              ),
            ),
          ],
          if (onApprove != null || onReject != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (onApprove != null)
                  Expanded(
                    child: ElevatedButton(
                      onPressed: onApprove,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00687A),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(
                        'Onayla',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                if (onApprove != null && onReject != null)
                  const SizedBox(width: 8),
                if (onReject != null)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onReject,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFEF4444)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: Text(
                        'Reddet',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFEF4444),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (bg, fg, label) = switch (status) {
      'APPROVED' => (const Color(0xFFDCFCE7), const Color(0xFF16A34A), 'Onaylı'),
      'REJECTED' => (const Color(0xFFFEE2E2), const Color(0xFFDC2626), 'Reddedildi'),
      _ => (const Color(0xFFFEF3C7), const Color(0xFFD97706), 'Bekliyor'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}
