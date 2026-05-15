import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/doctor_feedback/doctor_feedback_codec.dart';
import '../../../data/models/analysis_api_model.dart';
import '../../../services/analysis_service.dart';

/// Web `ImageAnalysisCard` / `ModalityConditionFeedback` / `FfaModalityDoctorFeedback`
/// ile aynı mantıkta seçimli doktor geri bildirimi (metin alanı yoktur).
class StructuredDoctorFeedbackForm extends StatefulWidget {
  const StructuredDoctorFeedbackForm({
    super.key,
    required this.initialRecord,
    required this.reportKind,
    required this.aiSummaryLabel,
    this.liveResponseBody,
    required this.onSaved,
  });

  final AnalysisApiModel initialRecord;
  final String reportKind;
  /// «Evet» ile `mai:` için kullanılan tek satırlık AI özeti (web `approvalAiSummaryLabel`).
  final String aiSummaryLabel;
  /// Canlı analiz gövdesi (`_result`); kayıtlı önizlemede null olabilir.
  final Map<String, dynamic>? liveResponseBody;
  final ValueChanged<AnalysisApiModel> onSaved;

  @override
  State<StructuredDoctorFeedbackForm> createState() =>
      _StructuredDoctorFeedbackFormState();
}

class _StructuredDoctorFeedbackFormState
    extends State<StructuredDoctorFeedbackForm> {
  bool _saving = false;

  bool? _fundusAgree;
  String? _fundusStageTr;
  bool _fundusNvd = false;
  bool _fundusNve = false;

  bool? _octAgree;
  final Set<String> _octSel = {};

  bool? _ffaAgree;
  final Set<String> _ffaSel = {};
  String? _ffaDrStageTr;
  bool _ffaNvd = false;
  bool _ffaNve = false;

  @override
  void initState() {
    super.initState();
    _hydrate(widget.initialRecord);
  }

  @override
  void didUpdateWidget(covariant StructuredDoctorFeedbackForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialRecord.id != widget.initialRecord.id ||
        oldWidget.initialRecord.updatedAt != widget.initialRecord.updatedAt) {
      _hydrate(widget.initialRecord);
    }
  }

  void _hydrate(AnalysisApiModel r) {
    final k = widget.reportKind.toLowerCase();
    if (k == 'fundus') {
      _hydrateFundus(r);
    } else if (k == 'oct') {
      _hydrateOct(r);
    } else {
      _hydrateFfa(r);
    }
    setState(() {});
  }

  void _hydrateFundus(AnalysisApiModel r) {
    _fundusNvd = false;
    _fundusNve = false;
    _parseFundusNv(r.doctorStructuredReview);
    final df = r.drFeedback?.trim() ?? '';
    if (r.isCorrect == true || isDoctorApprovalToken(df)) {
      _fundusAgree = true;
      _fundusStageTr = null;
      return;
    }
    final stageFromActual = r.actualResult?.trim();
    final idxDf = getDrStageIndexFromLabel(df);
    final idxAr = getDrStageIndexFromLabel(stageFromActual);
    if (r.isCorrect == false || idxDf != null || idxAr != null) {
      _fundusAgree = false;
      if (stageFromActual != null && stageFromActual.isNotEmpty) {
        _fundusStageTr = stageFromActual;
      } else if (idxDf != null) {
        _fundusStageTr = df;
      } else {
        _fundusStageTr = null;
      }
      return;
    }
    _fundusAgree = null;
    _fundusStageTr = null;
  }

  void _parseFundusNv(String? raw) {
    if (raw == null || raw.isEmpty) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final fa = m['fundusAssessment'] ?? m['fundus_assessment'];
      if (fa is Map<String, dynamic>) {
        final nv = fa['neovascularization'];
        if (nv is Map<String, dynamic>) {
          _fundusNvd = nv['nvd'] == true;
          _fundusNve = nv['nve'] == true;
        }
      }
    } catch (_) {}
  }

  void _hydrateOct(AnalysisApiModel r) {
    _octSel.clear();
    final raw = r.octDrFeedback?.trim() ?? '';
    if (raw.isEmpty && r.isCorrect == null) {
      _octAgree = null;
      return;
    }
    if (isDoctorApprovalToken(raw) ||
        decodeModalityAiAlignedLabel(raw) != null ||
        r.isCorrect == true) {
      _octAgree = true;
      return;
    }
    _octAgree = false;
    final multi = decodeOctMultiSelection(raw);
    if (multi.isNotEmpty) {
      _octSel.addAll(multi);
    } else if (raw.isNotEmpty && !isModalityDisagreePending(raw)) {
      _octSel.add(raw);
    }
  }

  void _hydrateFfa(AnalysisApiModel r) {
    _ffaSel.clear();
    _ffaDrStageTr = null;
    _ffaNvd = false;
    _ffaNve = false;
    final raw = r.ffaDrFeedback?.trim() ?? '';
    if (raw.isEmpty && r.isCorrect == null) {
      _ffaAgree = null;
      return;
    }
    if (isDoctorApprovalToken(raw) || r.isCorrect == true) {
      _ffaAgree = true;
      return;
    }
    _ffaAgree = false;
    final parsed = tryParseFfaDoctorFeedbackAny(raw);
    if (parsed != null && parsed['v'] == 3) {
      final diags =
          (parsed['diagnoses'] as List?)?.map((e) => '$e').toList() ?? [];
      _ffaSel.addAll(diags);
      _ffaDrStageTr = parsed['drStage']?.toString().trim();
      if (_ffaDrStageTr != null && _ffaDrStageTr!.isEmpty) {
        _ffaDrStageTr = null;
      }
      _ffaNvd = parsed['nvd'] == true;
      _ffaNve = parsed['nve'] == true;
    } else if (parsed != null && parsed['v'] == 2) {
      final d = parsed['diagnosis']?.toString().trim();
      if (d != null && d.isNotEmpty) _ffaSel.add(d);
      _ffaDrStageTr = parsed['drStage']?.toString().trim();
      if (_ffaDrStageTr != null && _ffaDrStageTr!.isEmpty) {
        _ffaDrStageTr = null;
      }
      _ffaNvd = parsed['nvd'] == true;
      _ffaNve = parsed['nve'] == true;
    }
  }

  Map<String, dynamic>? _octPayload() {
    final live = widget.liveResponseBody;
    if (live != null) {
      final o = live['oct'];
      if (o is Map) return Map<String, dynamic>.from(o);
    }
    try {
      final j = widget.initialRecord.aiInferenceJson;
      if (j == null || j.isEmpty) return null;
      final root = jsonDecode(j) as Map<String, dynamic>?;
      final o = root?['oct'];
      if (o is Map) return Map<String, dynamic>.from(o);
    } catch (_) {}
    return null;
  }

  Map<String, dynamic>? _ffaPayload() {
    final live = widget.liveResponseBody;
    if (live != null) {
      final o = live['ffa'];
      if (o is Map) return Map<String, dynamic>.from(o);
    }
    try {
      final j = widget.initialRecord.aiInferenceJson;
      if (j == null || j.isEmpty) return null;
      final root = jsonDecode(j) as Map<String, dynamic>?;
      final o = root?['ffa'];
      if (o is Map) return Map<String, dynamic>.from(o);
    } catch (_) {}
    return null;
  }

  List<Map<String, dynamic>>? _conditionsFromOct(Map<String, dynamic>? oct) {
    final c = oct?['conditions'];
    if (c is! List) return null;
    return c.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<Map<String, dynamic>>? _diseasesFromFfa(Map<String, dynamic>? ffa) {
    final d = ffa?['diseases'];
    if (d is! List) return null;
    return d.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  List<({String value, String label})> _octCheckboxRows() {
    final oct = _octPayload();
    final merged = mergeOctStaticWithAiConditions(_conditionsFromOct(oct));
    final rows = merged
        .map(
          (r) => (
            value: r.value,
            label: octTurkishLabel(r.value),
          ),
        )
        .toList();
    rows.add((value: kOctHealthyValue, label: octTurkishLabel(kOctHealthyValue)));
    return rows;
  }

  List<({String value, String label})> _ffaCheckboxRows() {
    final ffa = _ffaPayload();
    final merged = mergeFfaStaticWithDiseases(_diseasesFromFfa(ffa));
    return merged
        .map((r) => (value: r.value, label: ffaTurkishLabel(r.value)))
        .toList();
  }

  Map<String, dynamic>? _buildPatch() {
    final k = widget.reportKind.toLowerCase();
    if (k == 'fundus') return _patchFundus();
    if (k == 'oct') return _patchOct();
    return _patchFfa();
  }

  Map<String, dynamic>? _patchFundus() {
    if (_fundusAgree == null) return null;
    if (_fundusAgree == true) {
      final label = widget.aiSummaryLabel.trim();
      return {
        'isCorrect': true,
        'actualResult': null,
        'drFeedback': label.isEmpty
            ? kModalityDoctorApprovalValue
            : encodeModalityAiAlignedLabel(label),
        'doctorStructuredReview': null,
      };
    }
    if (_fundusStageTr == null || _fundusStageTr!.trim().isEmpty) {
      return null;
    }
    final stage = _fundusStageTr!.trim();
    final struct = jsonEncode({
      'fundusAssessment': {
        'neovascularization': {
          'nvd': _fundusNvd,
          'nve': _fundusNve,
        },
      },
    });
    return {
      'isCorrect': false,
      'actualResult': stage,
      'drFeedback': stage,
      'doctorStructuredReview': struct,
    };
  }

  Map<String, dynamic>? _patchOct() {
    if (_octAgree == null) return null;
    if (_octAgree == true) {
      final label = widget.aiSummaryLabel.trim();
      return {
        'isCorrect': true,
        'octDrFeedback': label.isEmpty
            ? kModalityDoctorApprovalValue
            : encodeModalityAiAlignedLabel(label),
      };
    }
    if (_octSel.isEmpty) return null;
    final enc = encodeOctMultiSelection(_octSel);
    final stored = modalityOctFeedbackForStorage(enc);
    return {
      'isCorrect': false,
      'octDrFeedback': stored,
    };
  }

  Map<String, dynamic>? _patchFfa() {
    if (_ffaAgree == null) return null;
    if (_ffaAgree == true) {
      final label = widget.aiSummaryLabel.trim();
      return {
        'isCorrect': true,
        'ffaDrFeedback': label.isEmpty
            ? kModalityDoctorApprovalValue
            : encodeModalityAiAlignedLabel(label),
      };
    }
    if (_ffaSel.isEmpty) return null;
    final sorted = [..._ffaSel]..sort();
    if (sorted.contains(kFfaHealthyValue)) {
      if (sorted.length > 1) return null;
      final s = encodeFfaDoctorFeedbackV3(diagnoses: [kFfaHealthyValue]);
      return {
        'isCorrect': false,
        'ffaDrFeedback': modalityFfaFeedbackForStorage(s),
      };
    }
    if (sorted.contains('ffa_dr')) {
      final st = _ffaDrStageTr?.trim() ?? '';
      if (st.isEmpty) return null;
      final s = encodeFfaDoctorFeedbackV3(
        diagnoses: sorted,
        drStage: st,
        nvd: _ffaNvd,
        nve: _ffaNve,
      );
      return {
        'isCorrect': false,
        'ffaDrFeedback': modalityFfaFeedbackForStorage(s),
      };
    }
    final s = encodeFfaDoctorFeedbackV3(diagnoses: sorted);
    return {
      'isCorrect': false,
      'ffaDrFeedback': modalityFfaFeedbackForStorage(s),
    };
  }

  Future<void> _save() async {
    final patch = _buildPatch();
    if (patch == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Lütfen tüm seçimleri tamamlayın.',
            style: GoogleFonts.inter(),
          ),
          backgroundColor: const Color(0xFF93000A),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final updated = await AnalysisService.instance.update(
        widget.initialRecord.id,
        patch,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Geri bildirim kaydedildi.', style: GoogleFonts.inter()),
          backgroundColor: const Color(0xFF1B5E20),
          behavior: SnackBarBehavior.floating,
        ),
      );
      widget.onSaved(updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Kayıt hatası: $e', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFF93000A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final k = widget.reportKind.toLowerCase();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Text(
          'Doktor geri bildirimi',
          style: GoogleFonts.manrope(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF14243D),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'AI çıktısı klinik olarak uygun mu?',
          style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _yesNoChip(
                label: 'EVET',
                selected: k == 'fundus'
                    ? _fundusAgree == true
                    : k == 'oct'
                        ? _octAgree == true
                        : _ffaAgree == true,
                onTap: () => setState(() {
                  if (k == 'fundus') {
                    _fundusAgree = true;
                    _fundusStageTr = null;
                    _fundusNvd = false;
                    _fundusNve = false;
                  } else if (k == 'oct') {
                    _octAgree = true;
                    _octSel.clear();
                  } else {
                    _ffaAgree = true;
                    _ffaSel.clear();
                    _ffaDrStageTr = null;
                    _ffaNvd = false;
                    _ffaNve = false;
                  }
                }),
                bg: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _yesNoChip(
                label: 'HAYIR',
                selected: k == 'fundus'
                    ? _fundusAgree == false
                    : k == 'oct'
                        ? _octAgree == false
                        : _ffaAgree == false,
                onTap: () => setState(() {
                  if (k == 'fundus') {
                    _fundusAgree = false;
                    _fundusStageTr = null;
                  } else if (k == 'oct') {
                    _octAgree = false;
                    _octSel.clear();
                  } else {
                    _ffaAgree = false;
                    _ffaSel.clear();
                    _ffaDrStageTr = null;
                    _ffaNvd = false;
                    _ffaNve = false;
                  }
                }),
                bg: const Color(0xFFBE123C),
              ),
            ),
          ],
        ),
        if (k == 'fundus' && _fundusAgree == false) ...[
          const SizedBox(height: 12),
          Text(
            'Düzeltme: DR evresi (tek seçim)',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: const Color(0xFFBE123C),
            ),
          ),
          const SizedBox(height: 6),
          ...kDrStageLabelsTr.map((lbl) {
            final v = lbl.trim();
            final checked = _fundusStageTr != null &&
                (_fundusStageTr == lbl || _fundusStageTr == v);
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: InkWell(
                onTap: () => setState(() => _fundusStageTr = lbl),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: checked
                          ? const Color(0xFFFB7185)
                          : const Color(0xFFFECDD3),
                    ),
                    borderRadius: BorderRadius.circular(8),
                    color: checked ? Colors.white : const Color(0xFFFFF1F2),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        checked
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        size: 18,
                        color: checked
                            ? const Color(0xFFBE123C)
                            : const Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          lbl.trim(),
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF1E293B),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
          const SizedBox(height: 8),
          Text(
            'Neovaskülarizasyon (isteğe bağlı)',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: const Color(0xFFBE123C),
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: Text('NVD', style: GoogleFonts.inter(fontSize: 13)),
            value: _fundusNvd,
            onChanged: (v) => setState(() => _fundusNvd = v ?? false),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: Text('NVE', style: GoogleFonts.inter(fontSize: 13)),
            value: _fundusNve,
            onChanged: (v) => setState(() => _fundusNve = v ?? false),
          ),
        ],
        if (k == 'oct' && _octAgree == false) ...[
          const SizedBox(height: 12),
          Text(
            'Klinik düzeltme (bir veya birden fazla işaretleyin)',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: const Color(0xFFBE123C),
            ),
          ),
          const SizedBox(height: 6),
          ..._octCheckboxRows().map((row) {
            final checked = _octSel.contains(row.value);
            final healthyOn = _octSel.contains(kOctHealthyValue);
            final disabled =
                healthyOn && row.value != kOctHealthyValue;
            return CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(row.label, style: GoogleFonts.inter(fontSize: 13)),
              value: checked,
              onChanged: disabled
                  ? null
                  : (v) {
                      setState(() {
                        if (row.value == kOctHealthyValue) {
                          if (v == true) {
                            _octSel
                              ..clear()
                              ..add(kOctHealthyValue);
                          } else {
                            _octSel.remove(kOctHealthyValue);
                          }
                        } else {
                          _octSel.remove(kOctHealthyValue);
                          if (v == true) {
                            _octSel.add(row.value);
                          } else {
                            _octSel.remove(row.value);
                          }
                        }
                      });
                    },
            );
          }),
        ],
        if (k == 'ffa' && _ffaAgree == false) ...[
          const SizedBox(height: 12),
          Text(
            'Klinik düzeltme (teşhis seçimi)',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: const Color(0xFFBE123C),
            ),
          ),
          const SizedBox(height: 6),
          ..._ffaCheckboxRows().map((row) {
            final checked = _ffaSel.contains(row.value);
            final healthyOn = _ffaSel.contains(kFfaHealthyValue);
            final disabled =
                healthyOn && row.value != kFfaHealthyValue;
            return CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(row.label, style: GoogleFonts.inter(fontSize: 13)),
              value: checked,
              onChanged: disabled
                  ? null
                  : (v) {
                      setState(() {
                        if (row.value == kFfaHealthyValue) {
                          if (v == true) {
                            _ffaSel
                              ..clear()
                              ..add(kFfaHealthyValue);
                            _ffaDrStageTr = null;
                            _ffaNvd = false;
                            _ffaNve = false;
                          } else {
                            _ffaSel.remove(kFfaHealthyValue);
                          }
                        } else {
                          _ffaSel.remove(kFfaHealthyValue);
                          if (v == true) {
                            _ffaSel.add(row.value);
                          } else {
                            _ffaSel.remove(row.value);
                            if (!_ffaSel.contains('ffa_dr')) {
                              _ffaDrStageTr = null;
                              _ffaNvd = false;
                              _ffaNve = false;
                            }
                          }
                        }
                      });
                    },
            );
          }),
          if (_ffaSel.contains('ffa_dr')) ...[
            const SizedBox(height: 8),
            Text(
              'DR evresi (FFA-DR için zorunlu)',
              style: GoogleFonts.manrope(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFBE123C),
              ),
            ),
            const SizedBox(height: 4),
            ...kDrStageLabelsTr.map((lbl) {
              final checked = _ffaDrStageTr == lbl;
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: InkWell(
                  onTap: () => setState(() => _ffaDrStageTr = lbl),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: checked
                            ? const Color(0xFFFB7185)
                            : const Color(0xFFFECDD3),
                      ),
                      borderRadius: BorderRadius.circular(8),
                      color: checked ? Colors.white : const Color(0xFFFFF1F2),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          checked
                              ? Icons.radio_button_checked
                              : Icons.radio_button_off,
                          size: 18,
                          color: checked
                              ? const Color(0xFFBE123C)
                              : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            lbl.trim(),
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text('NVD (FFA-DR)', style: GoogleFonts.inter(fontSize: 13)),
              value: _ffaNvd,
              onChanged: (v) => setState(() => _ffaNvd = v ?? false),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text('NVE (FFA-DR)', style: GoogleFonts.inter(fontSize: 13)),
              value: _ffaNve,
              onChanged: (v) => setState(() => _ffaNve = v ?? false),
            ),
          ],
        ],
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0A8FB6),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    'Geri bildirimi kaydet',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _yesNoChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    required Color bg,
  }) {
    return Material(
      color: selected ? bg : Colors.white,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? bg : const Color(0xFFCBD5E1),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: selected ? Colors.white : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }
}
