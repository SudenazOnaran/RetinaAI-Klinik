import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:dio/dio.dart';

import '../../data/models/patient_api_model.dart';
import '../../data/models/clinical_report_model.dart';
import '../../data/local/database/clinical_report_dao.dart';
import '../../data/local/database/analysis_dao.dart';
import '../../data/models/analysis_api_model.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../services/analysis_service.dart';
import '../../core/utils/uuid_generator.dart';
import 'widgets/structured_doctor_feedback_form.dart';

Map<String, dynamic>? _parseAiInferenceMap(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  try {
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
  } catch (_) {}
  return null;
}

/// `report_kind` = `radiological_ai` (web) veya boş olabilir; gerçek modalite JSON / URL ile çözülür.
String? effectiveReportKindFromAnalysis(AnalysisApiModel a) {
  final root = _parseAiInferenceMap(a.aiInferenceJson);

  if (root != null) {
    final modality = root['modality']?.toString().trim().toLowerCase();
    if (modality == 'oct' || modality == 'ffa' || modality == 'fundus') {
      return modality;
    }

    final octVal = root['oct'];
    final ffaVal = root['ffa'];
    if (ffaVal is Map) return 'ffa';
    if (octVal is Map) return 'oct';

    if (root.containsKey('pytorch') ||
        root.containsKey('drGrade') ||
        root.containsKey('dr_grade') ||
        root.containsKey('drLabel') ||
        root.containsKey('dr_label') ||
        root.containsKey('clinicalReasoning') ||
        root.containsKey('clinical_reasoning') ||
        root.containsKey('fundusFindings') ||
        root.containsKey('fundus_findings')) {
      return 'fundus';
    }
  }

  final rk = a.reportKind?.trim().toLowerCase();
  if (rk == 'oct' || rk == 'ffa' || rk == 'fundus') return rk;

  final fromUrls = _inferSingleModalityFromImageUrls(a);
  if (fromUrls != null) return fromUrls;

  return null;
}

bool _nonEmptyUrl(String? u) => u != null && u.trim().isNotEmpty;

/// Yalnızca tek modalite URL’si varsa döndürür (çok modlu kayıtta null).
String? _inferSingleModalityFromImageUrls(AnalysisApiModel a) {
  final hasFfa = _nonEmptyUrl(a.ffaImageUrl);
  final hasOct = _nonEmptyUrl(a.octImageUrl);
  final hasFundus = _nonEmptyUrl(a.originalImage) || _nonEmptyUrl(a.heatmapUrl);
  final n = (hasFfa ? 1 : 0) + (hasOct ? 1 : 0) + (hasFundus ? 1 : 0);
  if (n != 1) return null;
  if (hasFfa) return 'ffa';
  if (hasOct) return 'oct';
  if (hasFundus) return 'fundus';
  return null;
}

/// Geri bildirim formu yalnızca fundus | oct | ffa kabul eder (`radiological_ai` yok).
String resolvedFeedbackModalityForAnalysis(AnalysisApiModel a) {
  final inferred = effectiveReportKindFromAnalysis(a) ??
      _inferSingleModalityFromImageUrls(a);
  if (inferred == 'oct' || inferred == 'ffa' || inferred == 'fundus') {
    return inferred!;
  }
  final rk = a.reportKind?.trim().toLowerCase();
  if (rk == 'oct' || rk == 'ffa' || rk == 'fundus') return rk!;
  return 'fundus';
}

String radiologyModalityDisplayTitle(String? kind) {
  switch (kind?.toLowerCase()) {
    case 'oct':
      return 'OCT';
    case 'ffa':
      return 'FFA';
    case 'fundus':
      return 'Fundus';
    case 'radiological_ai':
      return 'Radyolojik AI';
    case 'clinical_manual':
      return 'Klinik rapor';
    default:
      return 'AI analizi';
  }
}

Map<String, dynamic> _buildInferenceSnapshot(
  String modality,
  Map<String, dynamic> body,
) {
  final m = modality.toLowerCase();
  if (m == 'oct') {
    return {
      'modality': 'oct',
      'oct': body['oct'],
      'success': body['success'],
      'inference': body['inference'],
    };
  }
  if (m == 'ffa') {
    return {
      'modality': 'ffa',
      'ffa': body['ffa'],
      'success': body['success'],
      'inference': body['inference'],
    };
  }
  final od = body['odir'];
  return {
    'modality': 'fundus',
    'drGrade': body['drGrade'] ?? body['dr_grade'],
    'drLabel': body['drLabel'] ?? body['dr_label'],
    'pytorch': body['pytorch'],
    'clinicalReasoning':
        body['clinicalReasoning'] ?? body['clinical_reasoning'],
    'clinicalDecision':
        body['clinicalDecision'] ?? body['clinical_decision'],
    'uncertaintyNote':
        body['uncertaintyNote'] ?? body['uncertainty_note'],
    'dmeSuspected': body['dmeSuspected'] ?? body['dme_suspected'],
    'dmeConfidence': body['dmeConfidence'] ?? body['dme_confidence'],
    'fundusFindings': body['fundusFindings'] ?? body['fundus_findings'],
    'fundusAssessment':
        body['fundusAssessment'] ?? body['fundus_assessment'],
    if (od is Map) 'odir': Map<String, dynamic>.from(od),
  };
}

/// Bazı proxy/gateway yanıtları `{ success, data: { ... asıl gövde } }` dönebilir.
Map<String, dynamic> _mergeAiResponseEnvelope(Map<String, dynamic> body) {
  final data = body['data'];
  if (data is Map) {
    final inner = Map<String, dynamic>.from(data);
    if (inner.containsKey('oct') ||
        inner.containsKey('ffa') ||
        inner.containsKey('pytorch') ||
        inner.containsKey('clinicalReasoning') ||
        inner.containsKey('clinical_reasoning')) {
      final merged = Map<String, dynamic>.from(body);
      inner.forEach((k, v) {
        if (v != null) merged[k] = v;
      });
      return merged;
    }
  }
  return body;
}

String? _labelFromAiBody(String modality, Map<String, dynamic> body) {
  final m = modality.toLowerCase();
  if (m == 'oct') {
    final oct = body['oct'];
    if (oct is! Map) return 'OCT yanıtı eksik';
    final octMap = Map<String, dynamic>.from(oct);
    final conditions = octMap['conditions'] as List?;
    if (conditions != null && conditions.isNotEmpty) {
      final c0 = conditions.first;
      if (c0 is Map) {
        final name = c0['name']?.toString().trim() ?? '';
        final lk = c0['likelihood']?.toString().trim() ?? '';
        if (name.isEmpty) return 'Koşul belirtilmedi';
        return lk.isEmpty ? name : '$name ($lk)';
      }
    }
    final summary = octMap['clinicalSummary']?.toString().trim() ?? '';
    if (summary.isEmpty) return 'Özet üretilemedi';
    return summary.length > 90 ? '${summary.substring(0, 90)}…' : summary;
  }
  if (m == 'ffa') {
    final ffa = body['ffa'];
    if (ffa is! Map) return 'FFA yanıtı eksik';
    final ffaMap = Map<String, dynamic>.from(ffa);
    final diseases = ffaMap['diseases'] as List?;
    if (diseases != null && diseases.isNotEmpty) {
      final d0 = diseases.first;
      if (d0 is Map) {
        final name = d0['name']?.toString().trim() ?? '';
        final lk = d0['likelihood']?.toString().trim() ?? '';
        if (name.isEmpty) return 'Bulgu belirtilmedi';
        return lk.isEmpty ? name : '$name ($lk)';
      }
    }
    final summary = ffaMap['clinicalSummary']?.toString().trim() ?? '';
    if (summary.isEmpty) return 'Özet üretilemedi';
    return summary.length > 90 ? '${summary.substring(0, 90)}…' : summary;
  }
  final pytorch = body['pytorch'] as Map<String, dynamic>?;
  final label = pytorch?['label'] as String?;
  final confidence = ((pytorch?['confidence'] as num?) ?? 0).toDouble();
  if (confidence < 0.75 || label == null) return 'Belirsiz';
  return label;
}

double _confidenceFromAiBody(String modality, Map<String, dynamic> body) {
  final m = modality.toLowerCase();
  if (m == 'oct') {
    final oct = body['oct'];
    if (oct is! Map) return 0.35;
    final cs =
        (Map<String, dynamic>.from(oct)['confidenceScore'] as num?)
            ?.toDouble() ??
        0;
    if (cs <= 0) return 0.35;
    return (cs / 100.0).clamp(0.0, 1.0);
  }
  if (m == 'ffa') {
    final ffa = body['ffa'];
    if (ffa is! Map) return 0.35;
    final cs =
        (Map<String, dynamic>.from(ffa)['confidenceScore'] as num?)
            ?.toDouble() ??
        0;
    if (cs <= 0) return 0.35;
    return (cs / 100.0).clamp(0.0, 1.0);
  }
  final pytorch = body['pytorch'] as Map<String, dynamic>?;
  return ((pytorch?['confidence'] as num?) ?? 0).toDouble().clamp(0.0, 1.0);
}

List<Widget> _clinicalWidgetsFromInferenceMap(Map<String, dynamic>? map) {
  if (map == null || map.isEmpty) return [];
  final modality =
      (map['modality'] ?? 'fundus').toString().toLowerCase();
  final out = <Widget>[];

  void addHeading(String t) {
    out.add(
      Text(
        t,
        style: GoogleFonts.manrope(
          fontWeight: FontWeight.w700,
          fontSize: 12,
          color: const Color(0xFF64748B),
        ),
      ),
    );
    out.add(const SizedBox(height: 4));
  }

  void addBody(String t) {
    out.add(
      Text(
        t,
        style: GoogleFonts.inter(
          fontSize: 13,
          color: const Color(0xFF1E293B),
          height: 1.5,
        ),
      ),
    );
    out.add(const SizedBox(height: 12));
  }

  if (modality == 'fundus') {
    final cr = (map['clinicalReasoning'] ?? map['clinical_reasoning'])
        ?.toString()
        .trim();
    if (cr != null && cr.isNotEmpty) {
      addHeading('Klinik gerekçe');
      addBody(cr);
    }
    final un = (map['uncertaintyNote'] ?? map['uncertainty_note'])
        ?.toString()
        .trim();
    if (un != null && un.isNotEmpty) {
      addHeading('Belirsizlik notu');
      addBody(un);
    }
    final cd = map['clinicalDecision'] ?? map['clinical_decision'];
    if (cd is Map) {
      final follow =
          (cd['followUpTr'] ?? cd['follow_up_tr'])?.toString().trim();
      final urg = cd['urgency']?.toString().trim();
      final ref = cd['referableDr'] ?? cd['referable_dr'];
      final actions = cd['recommendedActions'] ?? cd['recommended_actions'];
      final buf = StringBuffer();
      if (follow != null && follow.isNotEmpty) {
        buf.writeln(follow);
      }
      if (urg != null && urg.isNotEmpty) {
        buf.writeln('Öncelik: $urg');
      }
      if (ref != null) {
        buf.writeln('Sevk önerisi (DR): $ref');
      }
      if (actions is List && actions.isNotEmpty) {
        buf.writeln('Önerilen adımlar:');
        for (final a in actions) {
          buf.writeln('• ${a.toString().trim()}');
        }
      }
      final block = buf.toString().trim();
      if (block.isNotEmpty) {
        addHeading('Klinik öneri özeti');
        addBody(block);
      }
    }
    final dme = map['dmeSuspected'] ?? map['dme_suspected'];
    if (dme == true) {
      addHeading('DME şüphesi');
      addBody('Evet (model uyarısı; kesin tanı değildir).');
    }
    dynamic rawFf = map['fundusFindings'] ?? map['fundus_findings'];
    dynamic rawFa = map['fundusAssessment'] ?? map['fundus_assessment'];
    if (rawFf != null) {
      final t = rawFf is String ? rawFf.trim() : jsonEncode(rawFf);
      if (t.isNotEmpty && t != '{}' && t != '[]') {
        addHeading('Fundus bulguları');
        addBody(t);
      }
    }
    if (rawFa != null) {
      final t = rawFa is String ? rawFa.trim() : jsonEncode(rawFa);
      if (t.isNotEmpty && t != '{}' && t != '[]') {
        addHeading('Fundus değerlendirme');
        addBody(t);
      }
    }
  } else if (modality == 'oct') {
    final oct = map['oct'];
    if (oct is Map) {
      final om = Map<String, dynamic>.from(oct);
      final iq = om['imageQuality']?.toString().trim();
      if (iq != null && iq.isNotEmpty) {
        addHeading('Görüntü kalitesi');
        addBody(iq);
      }
      final summary = om['clinicalSummary']?.toString().trim();
      if (summary != null && summary.isNotEmpty) {
        addHeading('Klinik özet');
        addBody(summary);
      }
      final findings = om['findings'];
      if (findings is List && findings.isNotEmpty) {
        addHeading('Bulgular');
        addBody(findings.map((e) => '• ${e.toString().trim()}').join('\n'));
      }
      final conds = om['conditions'] as List?;
      if (conds != null && conds.isNotEmpty) {
        addHeading('Koşullar / olasılıklar');
        final lines = <String>[];
        for (final c in conds) {
          if (c is! Map) continue;
          final name = c['name']?.toString().trim() ?? '';
          final lk = c['likelihood']?.toString().trim() ?? '';
          lines.add(
            lk.isEmpty ? name : '$name — olasılık: $lk',
          );
        }
        if (lines.isNotEmpty) {
          addBody(lines.map((l) => '• $l').join('\n'));
        }
      }
      final recs = om['recommendations'];
      if (recs is List && recs.isNotEmpty) {
        addHeading('Öneriler');
        addBody(recs.map((e) => '• ${e.toString().trim()}').join('\n'));
      }
    }
  } else if (modality == 'ffa') {
    final ffa = map['ffa'];
    if (ffa is Map) {
      final fm = Map<String, dynamic>.from(ffa);
      final iq = fm['imageQuality']?.toString().trim();
      if (iq != null && iq.isNotEmpty) {
        addHeading('Görüntü kalitesi');
        addBody(iq);
      }
      final summary = fm['clinicalSummary']?.toString().trim();
      if (summary != null && summary.isNotEmpty) {
        addHeading('Klinik özet');
        addBody(summary);
      }
      final findings = fm['findings'];
      if (findings is List && findings.isNotEmpty) {
        addHeading('Bulgular');
        addBody(findings.map((e) => '• ${e.toString().trim()}').join('\n'));
      }
      final diseases = fm['diseases'] as List?;
      if (diseases != null && diseases.isNotEmpty) {
        addHeading('Hastalık olasılıkları');
        final lines = <String>[];
        for (final d in diseases) {
          if (d is! Map) continue;
          final name = d['name']?.toString().trim() ?? '';
          final lk = d['likelihood']?.toString().trim() ?? '';
          lines.add(lk.isEmpty ? name : '$name — olasılık: $lk');
        }
        if (lines.isNotEmpty) {
          addBody(lines.map((l) => '• $l').join('\n'));
        }
      }
      final recs = fm['recommendations'];
      if (recs is List && recs.isNotEmpty) {
        addHeading('Öneriler');
        addBody(recs.map((e) => '• ${e.toString().trim()}').join('\n'));
      }
    }
  }
  if (out.isNotEmpty && out.last is SizedBox) {
    out.removeLast();
  }
  return out;
}

/// PDF / forma aktarım için düz metin (widget ayrıştırması yok).
String? _inferencePlainNarration(Map<String, dynamic>? map) {
  if (map == null || map.isEmpty) return null;
  final w = _clinicalWidgetsFromInferenceMap(map);
  final buf = StringBuffer();
  for (final el in w) {
    if (el is Text) {
      final t = el.data;
      if (t != null && t.isNotEmpty) {
        buf.writeln(t);
      }
    }
  }
  final s = buf.toString().trim();
  return s.isEmpty ? null : s;
}

Map<String, dynamic> _normalizeAiResponseBody(dynamic raw) {
  if (raw == null) return {};
  if (raw is String) {
    final s = raw.trim();
    if (s.isEmpty) return {};
    try {
      final d = jsonDecode(s);
      if (d is Map) return Map<String, dynamic>.from(d);
    } catch (_) {}
    return {};
  }
  if (raw is Map) {
    return Map<String, dynamic>.from(raw);
  }
  return {};
}

dynamic _jsonSanitize(dynamic value) {
  if (value == null || value is num || value is String || value is bool) {
    return value;
  }
  if (value is List) {
    return value.map(_jsonSanitize).toList();
  }
  if (value is Map) {
    return value.map(
      (k, v) => MapEntry(k.toString(), _jsonSanitize(v)),
    );
  }
  return value.toString();
}

Uint8List? _decodeHeatmapImageBytes(String? heatmapRaw) {
  if (heatmapRaw == null || heatmapRaw.isEmpty) return null;
  try {
    if (heatmapRaw.startsWith('data:')) {
      final uri = Uri.parse(heatmapRaw);
      final data = uri.data;
      if (data != null) return Uint8List.fromList(data.contentAsBytes());
    }
    final b64 = heatmapRaw.contains(',')
        ? heatmapRaw.split(',').last
        : heatmapRaw;
    return base64Decode(b64);
  } catch (_) {
    return null;
  }
}

class PatientDetailScreen extends StatefulWidget {
  const PatientDetailScreen({super.key, required this.patient});

  final PatientApiModel patient;

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with TickerProviderStateMixin {
  late final TabController _tabController;

  // Rapor Oluştur sekmesine «Rapora aktar» ile eklenen AI özetleri (web ile aynı akış)
  String _fundusTransferText = '';
  String _octTransferText = '';
  String _ffaTransferText = '';

  List<ClinicalReportModel> _savedReports = [];
  List<AnalysisApiModel> _analyses = [];
  bool _savingReport = false;

  final _reportTitleController = TextEditingController();
  final _doctorController = TextEditingController();
  final _anamnesisController = TextEditingController();
  final _examController = TextEditingController();
  final _labController = TextEditingController();
  final _diagnosisController = TextEditingController();
  final _treatmentController = TextEditingController();
  final _doctorNotesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadSavedReports();
    _loadAnalyses();
  }

  Future<void> _loadAnalyses() async {
    final analyses = await AnalysisDao.instance.getByPatientId(
      widget.patient.id,
    );
    if (mounted) setState(() => _analyses = analyses);
  }

  /// Bu hasta için ilgili türde en son AI analizi (created_at DESC).
  AnalysisApiModel? _latestAnalysisForKind(String kind) {
    final k = kind.toLowerCase();
    for (final a in _analyses) {
      final ek =
          effectiveReportKindFromAnalysis(a) ?? (a.reportKind ?? '').toLowerCase();
      if (ek == k) return a;
    }
    return null;
  }

  void _openRadiologicalReportsTab() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Analizler kaydedildiğinde «Radyolojik raporlar» listesinde görünür. Özetleri yukarıdan «Rapora aktar» ile klinik rapora da ekleyebilirsiniz.',
          style: GoogleFonts.inter(fontSize: 13),
        ),
        backgroundColor: const Color(0xFF1B5E20),
        behavior: SnackBarBehavior.floating,
      ),
    );
    _tabController.animateTo(3);
  }

  Future<void> _loadSavedReports() async {
    final reports = await ClinicalReportDao.instance.getByPatientId(
      widget.patient.id,
    );
    if (mounted) setState(() => _savedReports = reports);
  }

  Future<void> _saveReport() async {
    setState(() => _savingReport = true);
    try {
      final allAiNotes = [
        if (_fundusTransferText.isNotEmpty) 'Fundus: $_fundusTransferText',
        if (_octTransferText.isNotEmpty) 'OCT: $_octTransferText',
        if (_ffaTransferText.isNotEmpty) 'FFA: $_ffaTransferText',
      ].join('\n');

      final report = ClinicalReportModel.create(
        patientId: widget.patient.id,
        title: _reportTitleController.text,
        doctorName: _doctorController.text,
        anamnesis: _anamnesisController.text,
        examFindings: _examController.text,
        labResults: _labController.text,
        diagnosis: _diagnosisController.text,
        treatment: _treatmentController.text,
        doctorNotes: _doctorNotesController.text,
        aiNotes: allAiNotes,
      );

      await ClinicalReportDao.instance.insert(report);
      await _loadSavedReports();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Rapor kaydedildi.', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFF1B5E20),
            behavior: SnackBarBehavior.floating,
          ),
        );
        // Raporlar sekmesine geç
        _tabController.animateTo(2);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFF93000A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingReport = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reportTitleController.dispose();
    _doctorController.dispose();
    _anamnesisController.dispose();
    _examController.dispose();
    _labController.dispose();
    _diagnosisController.dispose();
    _treatmentController.dispose();
    _doctorNotesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFFF3F6FA);
    const card = Colors.white;
    const border = Color(0xFFD7DFEA);
    const primary = Color(0xFF0A8FB6);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.patient.fullName,
              style: GoogleFonts.manrope(
                color: const Color(0xFF14243D),
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
            Text(
              'T.C.: ${widget.patient.tcNo}',
              style: GoogleFonts.inter(
                color: const Color(0xFF5D6B82),
                fontWeight: FontWeight.w500,
                fontSize: 12,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          indicatorColor: primary,
          labelColor: primary,
          unselectedLabelColor: const Color(0xFF8B9BB4),
          labelStyle: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
          unselectedLabelStyle: GoogleFonts.inter(fontSize: 12),
          tabs: const [
            Tab(text: 'Rapor Oluştur'),
            Tab(text: 'AI & Görüntü Analizi'),
            Tab(text: 'Geçmiş Raporlar'),
            Tab(text: 'Radyolojik raporlar'),
            Tab(text: 'DR Değişim Analizi'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Rapor Oluştur
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _panel(
                    card,
                    border,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.description_outlined,
                              color: primary,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Rapor editörü',
                              style: GoogleFonts.manrope(
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF14243D),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Klinik metin alanlarını doldurun. Fundus, OCT ve FFA yapay zeka araçları «AI & Görüntü Analizi» sekmesindedir.',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF4D5D77),
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _label('Rapor Başlığı'),
                        _input(
                          _reportTitleController,
                          hint: 'Göz Muayene Raporu',
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _label('Hasta Kimlik Bilgileri'),
                                  _readonlyInput(
                                    '${widget.patient.fullName} | T.C.: ${widget.patient.tcNo}',
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _label('Rapor Tarihi'),
                                  _readonlyInput(
                                    DateTime.now().toString().split(' ').first,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _label('Doktor Bilgisi'),
                        _input(_doctorController, hint: 'Dr. Adı Soyadı'),
                        const SizedBox(height: 10),
                        _label('Klinik Öykü (Anamnez)'),
                        _input(
                          _anamnesisController,
                          maxLines: 3,
                          hint:
                              'Hastanın şikayetı, semptom süresi, önceki tedavi öyküsü',
                        ),
                        const SizedBox(height: 10),
                        _label('Muayene Bulguları'),
                        _input(
                          _examController,
                          maxLines: 3,
                          hint:
                              'Görme keskinliği, biyomikroskopi, fundus muayenesi; yalnız klinik gözlemler',
                        ),
                        const SizedBox(height: 10),
                        _label('Laboratuvar Sonuçları'),
                        _input(
                          _labController,
                          maxLines: 3,
                          hint:
                              'HbA1c, glukoz, lipid profili gibi laboratuvar bilgileri',
                        ),
                        const SizedBox(height: 10),
                        _label('Teşhis / Klinik Değerlendirme'),
                        _input(
                          _diagnosisController,
                          maxLines: 3,
                          hint: 'Klinik değerlendirme ve nihai tanı',
                        ),
                        const SizedBox(height: 10),
                        _label('Tedavi ve Öneriler'),
                        _input(
                          _treatmentController,
                          maxLines: 3,
                          hint:
                              'Tedavi planı, ilaç önerileri ve kontrol önerisi',
                        ),
                        const SizedBox(height: 10),
                        _label('Doktor Notları'),
                        _input(
                          _doctorNotesController,
                          maxLines: 3,
                          hint:
                              'Ek klinik notlar, özel uyarılar veya takip planı',
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: primary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: _savingReport ? null : _saveReport,
                            child: _savingReport
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    'Raporu Kaydet',
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Tab 2: AI Analiz
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(12, 16, 12, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [_aiAnalysisPanel(card, border)],
              ),
            ),
          ),
          // Tab 3: Raporlar (klinik rapor geçmişi)
          SafeArea(
            child: _savedReports.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.description_outlined,
                            size: 56,
                            color: Color(0xFFB0BEC5),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Henüz klinik rapor bulunmuyor.',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '«Rapor Oluştur» sekmesinden klinik rapor kaydedebilirsiniz. AI analiz geçmişi «Radyolojik raporlar» sekmesindedir.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF9CA3AF),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                    itemCount: _savedReports.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final report = _savedReports[index];
                      return _ReportCard(report: report);
                    },
                  ),
          ),
          // Tab 4: Radyolojik Raporlar (AI analiz geçmişi)
          SafeArea(
            child: _analyses.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.biotech_outlined,
                            size: 56,
                            color: Color(0xFFB0BEC5),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Henüz radyolojik rapor bulunmuyor.',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '«AI & Görüntü Analizi» sekmesinden görsel yükleyerek analiz başlatın. Detay ve doktor geri bildirimi için kayda dokunun.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF9CA3AF),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: ListView.separated(
                      itemCount: _analyses.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final analysis = _analyses[index];
                        return _RadiologyCard(
                          analysis: analysis,
                          onRefresh: _loadAnalyses,
                        );
                      },
                    ),
                  ),
          ),
          // Tab 5: İlerleme (DR progression)
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.show_chart_rounded,
                      size: 56,
                      color: Color(0xFFB0BEC5),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Yeterli veri bulunamadı.',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'İlerleme grafiği görmek için en az 2 analiz gereklidir.',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF9CA3AF),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── AI Analiz Panel (Tab 2) — web `ManualReportCard` radiological + `AiAnalysisPanel` ──
  Widget _aiAnalysisPanel(Color card, Color border) {
    const primary = Color(0xFF0A8FB6);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: card,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.biotech_outlined,
                    color: primary,
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'AI analizi (Fundus / OCT / FFA)',
                          style: GoogleFonts.manrope(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF14243D),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Görüntüleri yükleyin veya analiz edin; kayıt «Radyolojik raporlar» listesinde görünür. Özeti kart üzerindeki «Rapora aktar» ile klinik rapor taslağına ekleyebilirsiniz.',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF4D5D77),
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Listeyi görmek veya akışı tamamlamak için aşağıdaki «Radyolojik raporu kaydet» düğmesini kullanın (analizler otomatik saklanır).',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFE1F5FE),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF81D4FA)),
          ),
          child: Text(
            'Fundus, OCT ve FFA için yapay zeka analizlerini kullanın; kayıt «Radyolojik raporlar» listesinde görünür.',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF0277BD),
              height: 1.35,
            ),
          ),
        ),
        const SizedBox(height: 16),
        _InlineAnalysisCard(
          icon: Icons.visibility_outlined,
          label: 'Fundus',
          subtitle: 'Retina fundus görüntüsü — DR evre tespiti',
          iconBg: const Color(0xFFE7F3FF),
          iconColor: const Color(0xFF005D90),
          apiEndpoint: ApiConstants.aiPredict,
          patientId: widget.patient.id,
          border: border,
          transferText: _fundusTransferText,
          onTransfer: (text) => setState(() => _fundusTransferText = text),
          onClearTransfer: () => setState(() => _fundusTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
          lastSavedAnalysis: _latestAnalysisForKind('fundus'),
        ),
        const SizedBox(height: 12),
        _InlineAnalysisCard(
          icon: Icons.grid_view_rounded,
          label: 'OCT',
          subtitle: 'Makula OCT görüntüsü — katman analizi',
          iconBg: const Color(0xFFF0FFF4),
          iconColor: const Color(0xFF006645),
          apiEndpoint: ApiConstants.aiPredictOct,
          patientId: widget.patient.id,
          border: border,
          transferText: _octTransferText,
          onTransfer: (text) => setState(() => _octTransferText = text),
          onClearTransfer: () => setState(() => _octTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
          lastSavedAnalysis: _latestAnalysisForKind('oct'),
        ),
        const SizedBox(height: 12),
        _InlineAnalysisCard(
          icon: Icons.blur_on_rounded,
          label: 'FFA',
          subtitle: 'Flöresein anjiyografi — damar değerlendirmesi',
          iconBg: const Color(0xFFFFF8E7),
          iconColor: const Color(0xFF8B5000),
          apiEndpoint: ApiConstants.aiPredictFfa,
          patientId: widget.patient.id,
          border: border,
          transferText: _ffaTransferText,
          onTransfer: (text) => setState(() => _ffaTransferText = text),
          onClearTransfer: () => setState(() => _ffaTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
          lastSavedAnalysis: _latestAnalysisForKind('ffa'),
        ),
        if (_fundusTransferText.isNotEmpty ||
            _octTransferText.isNotEmpty ||
            _ffaTransferText.isNotEmpty)
          ..._transferredResultBox(),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _openRadiologicalReportsTab,
            child: Text(
              'Radyolojik raporu kaydet',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }

  Widget _panel(Color card, Color border, {required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: card,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  List<Widget> _transferredResultBox() {
    return [
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFE8F5E9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFA5D6A7)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.check_circle_rounded,
                  size: 16,
                  color: Color(0xFF2E7D32),
                ),
                const SizedBox(width: 6),
                Text(
                  'Rapora aktarılan AI özeti:',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1B5E20),
                  ),
                ),
              ],
            ),
            if (_fundusTransferText.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Fundus: $_fundusTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
            if (_octTransferText.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'OCT: $_octTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
            if (_ffaTransferText.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'FFA: $_ffaTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              'Klinik rapora yazdırmak için «Rapor Oluştur» sekmesine geçip «Raporu Kaydet» ile kaydedin.',
              style: GoogleFonts.inter(
                fontSize: 10,
                color: const Color(0xFF2E7D32),
                fontStyle: FontStyle.italic,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    ];
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          color: const Color(0xFF2E3E56),
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _input(
    TextEditingController controller, {
    int maxLines = 1,
    String? hint,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        hintText: hint,
        hintStyle: GoogleFonts.inter(
          fontSize: 13,
          color: const Color(0xFFB0BEC5),
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      style: GoogleFonts.inter(fontSize: 13),
    );
  }

  Widget _readonlyInput(String text) {
    return TextField(
      enabled: false,
      controller: TextEditingController(text: text),
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF3F4F66)),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});
  final ClinicalReportModel report;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7DFEA)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.description_rounded,
                  size: 18,
                  color: Color(0xFF0A8FB6),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    report.title,
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: const Color(0xFF14243D),
                    ),
                  ),
                ),
                Text(
                  report.createdAtFormatted,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: Color(0xFF9CA3AF),
                ),
              ],
            ),
            if (report.diagnosis.isNotEmpty) ...[
              const SizedBox(height: 8),
              _row('Tanı', report.diagnosis),
            ],
            if (report.treatment.isNotEmpty) ...[
              const SizedBox(height: 4),
              _row('Tedavi', report.treatment),
            ],
            if (report.aiNotes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFA5D6A7)),
                ),
                child: Text(
                  'AI: ${report.aiNotes}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFF1B5E20),
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClinicalReportDetailSheet(report: report),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 52,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF1E293B),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Clinical Report Detail Bottom Sheet ────────────────────────────────────
class _ClinicalReportDetailSheet extends StatelessWidget {
  const _ClinicalReportDetailSheet({required this.report});
  final ClinicalReportModel report;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(
                    Icons.description_rounded,
                    size: 20,
                    color: Color(0xFF0A8FB6),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      report.title,
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  _detailRow('Tarih', report.createdAtFormatted),
                  _detailRow('Doktor', report.doctorName),
                  if (report.anamnesis.isNotEmpty)
                    _detailSection('Anamnez', report.anamnesis),
                  if (report.examFindings.isNotEmpty)
                    _detailSection('Muayene Bulguları', report.examFindings),
                  if (report.labResults.isNotEmpty)
                    _detailSection('Laboratuvar', report.labResults),
                  if (report.diagnosis.isNotEmpty)
                    _detailSection('Tanı', report.diagnosis),
                  if (report.treatment.isNotEmpty)
                    _detailSection('Tedavi', report.treatment),
                  if (report.doctorNotes.isNotEmpty)
                    _detailSection('Doktor Notları', report.doctorNotes),
                  if (report.aiNotes.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFA5D6A7)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'AI Notları',
                            style: GoogleFonts.manrope(
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                              color: const Color(0xFF1B5E20),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            report.aiNotes,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: const Color(0xFF2E7D32),
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('PDF Olarak İndir'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD32F2F),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () => _downloadPdf(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadPdf(BuildContext context) async {
    final fontRegular = await PdfGoogleFonts.notoSansRegular();
    final fontBold = await PdfGoogleFonts.notoSansBold();

    final doc = pw.Document();

    pw.TextStyle body(double size) =>
        pw.TextStyle(font: fontRegular, fontSize: size);
    pw.TextStyle bold(double size) => pw.TextStyle(
      font: fontBold,
      fontSize: size,
      fontWeight: pw.FontWeight.bold,
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
        build: (pw.Context ctx) => [
          pw.Header(
            level: 0,
            child: pw.Text('Klinik Rapor: ${report.title}', style: bold(18)),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            'Tarih: ${report.createdAtFormatted}   |   Doktor: ${report.doctorName}',
            style: body(11).copyWith(color: PdfColors.grey700),
          ),
          pw.Divider(),
          if (report.anamnesis.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Anamnez', style: bold(13))),
            pw.Text(report.anamnesis, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.examFindings.isNotEmpty) ...[
            pw.Header(
              level: 1,
              child: pw.Text('Muayene Bulgulari', style: bold(13)),
            ),
            pw.Text(report.examFindings, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.labResults.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Laboratuvar', style: bold(13))),
            pw.Text(report.labResults, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.diagnosis.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Tani', style: bold(13))),
            pw.Text(report.diagnosis, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.treatment.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Tedavi', style: bold(13))),
            pw.Text(report.treatment, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.doctorNotes.isNotEmpty) ...[
            pw.Header(
              level: 1,
              child: pw.Text('Doktor Notlari', style: bold(13)),
            ),
            pw.Text(report.doctorNotes, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.aiNotes.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('AI Notlari', style: bold(13))),
            pw.Text(report.aiNotes, style: body(12)),
          ],
        ],
      ),
    );
    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
      name: '${report.title}_${report.createdAtFormatted}.pdf',
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailSection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: const Color(0xFF2E3E56),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            content,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF1E293B),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Radiology Card ──────────────────────────────────────────────────────────
class _RadiologyCard extends StatelessWidget {
  const _RadiologyCard({required this.analysis, required this.onRefresh});
  final AnalysisApiModel analysis;
  final VoidCallback onRefresh;

  static IconData _kindIcon(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return Icons.grid_view_rounded;
      case 'ffa':
        return Icons.blur_on_rounded;
      case 'fundus':
        return Icons.visibility_outlined;
      default:
        return Icons.biotech_outlined;
    }
  }

  static Color _kindColor(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return const Color(0xFF006645);
      case 'ffa':
        return const Color(0xFF8B5000);
      case 'fundus':
        return const Color(0xFF005D90);
      default:
        return const Color(0xFF0A8FB6);
    }
  }

  String get _dateFormatted {
    final d = analysis.createdAt;
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  String get _confidenceText {
    final pct = (analysis.confidence * 100).toStringAsFixed(1);
    return 'Güven: %$pct';
  }

  @override
  Widget build(BuildContext context) {
    final kindRaw = effectiveReportKindFromAnalysis(analysis) ??
        _inferSingleModalityFromImageUrls(analysis) ??
        analysis.reportKind;
    final kindLabel = radiologyModalityDisplayTitle(kindRaw);
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7DFEA)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _kindColor(kindRaw).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_kindIcon(kindRaw), size: 22, color: _kindColor(kindRaw)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$kindLabel Analizi',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: const Color(0xFF14243D),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    analysis.aiResult,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFF1E293B),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _confidenceText,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _dateFormatted,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: Color(0xFF9CA3AF),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RadiologyDetailSheet(
        analysis: analysis,
        onChanged: onRefresh,
      ),
    );
  }
}

// ── Radiology Detail Bottom Sheet ──────────────────────────────────────────
class _RadiologyDetailSheet extends StatefulWidget {
  const _RadiologyDetailSheet({
    required this.analysis,
    required this.onChanged,
  });
  final AnalysisApiModel analysis;
  final VoidCallback onChanged;

  @override
  State<_RadiologyDetailSheet> createState() => _RadiologyDetailSheetState();
}

class _RadiologyDetailSheetState extends State<_RadiologyDetailSheet> {
  late AnalysisApiModel _analysis;

  String get _dateFormatted {
    final d = _analysis.createdAt;
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  @override
  void initState() {
    super.initState();
    _analysis = widget.analysis;
  }

  String _radiologyApprovalLabel() {
    final modality = effectiveReportKindFromAnalysis(_analysis) ??
        _inferSingleModalityFromImageUrls(_analysis);
    final root = _parseAiInferenceMap(_analysis.aiInferenceJson);
    if (root == null) return _analysis.aiResult;
    if (modality == 'oct') {
      final oct = root['oct'];
      if (oct is Map) {
        final l = _labelFromAiBody('OCT', {'oct': oct});
        if (l != null && l.isNotEmpty) return l;
      }
    } else if (modality == 'ffa') {
      final ffa = root['ffa'];
      if (ffa is Map) {
        final l = _labelFromAiBody('FFA', {'ffa': ffa});
        if (l != null && l.isNotEmpty) return l;
      }
    } else if (modality == 'fundus') {
      final l = _labelFromAiBody('Fundus', root);
      if (l != null && l.isNotEmpty) return l;
    }
    return _analysis.aiResult;
  }

  Future<void> _downloadPdf() async {
    final pct = (_analysis.confidence * 100).toStringAsFixed(1);
    final kindRaw = effectiveReportKindFromAnalysis(_analysis) ??
        _inferSingleModalityFromImageUrls(_analysis) ??
        _analysis.reportKind;
    final kind = radiologyModalityDisplayTitle(kindRaw);

    final fontRegular = await PdfGoogleFonts.notoSansRegular();
    final fontBold = await PdfGoogleFonts.notoSansBold();

    pw.MemoryImage? originalImg;
    pw.MemoryImage? heatmapImg;
    try {
      if (_analysis.originalImage != null &&
          _analysis.originalImage!.isNotEmpty &&
          File(_analysis.originalImage!).existsSync()) {
        originalImg = pw.MemoryImage(
          await File(_analysis.originalImage!).readAsBytes(),
        );
      }
    } catch (_) {}
    try {
      if (_analysis.heatmapUrl != null &&
          _analysis.heatmapUrl!.isNotEmpty &&
          _analysis.heatmapUrl!.startsWith('/') &&
          File(_analysis.heatmapUrl!).existsSync()) {
        heatmapImg = pw.MemoryImage(
          await File(_analysis.heatmapUrl!).readAsBytes(),
        );
      }
    } catch (_) {}

    final infMap = _parseAiInferenceMap(_analysis.aiInferenceJson);
    final detailBlock = _inferencePlainNarration(infMap);

    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
        build: (pw.Context ctx) => [
          pw.Header(
            level: 0,
            child: pw.Text(
              'Radyolojik Rapor: $kind Analizi',
              style: pw.TextStyle(
                font: fontBold,
                fontSize: 18,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            'Tarih: $_dateFormatted',
            style: pw.TextStyle(
              font: fontRegular,
              fontSize: 11,
              color: PdfColors.grey700,
            ),
          ),
          pw.Divider(),
          pw.Header(
            level: 1,
            child: pw.Text(
              'Analiz Sonucu',
              style: pw.TextStyle(font: fontBold),
            ),
          ),
          pw.Text(_analysis.aiResult, style: pw.TextStyle(font: fontRegular)),
          pw.SizedBox(height: 8),
          pw.Header(
            level: 1,
            child: pw.Text('Güven Skoru', style: pw.TextStyle(font: fontBold)),
          ),
          pw.Text('%$pct', style: pw.TextStyle(font: fontRegular)),
          if (detailBlock != null && detailBlock.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Detaylı açıklama',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              detailBlock,
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (_analysis.drFeedback != null &&
              _analysis.drFeedback!.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'DR Değerlendirmesi',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              _analysis.drFeedback!,
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (_analysis.isCorrect != null) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'AI doğruluk görüşü',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              _analysis.isCorrect == true
                  ? 'Klinik olarak uygun bulundu.'
                  : 'Klinik olarak uygun bulunmadı.',
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (_analysis.actualResult != null &&
              _analysis.actualResult!.trim().isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Gerçek sonuç / düzeltme',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              _analysis.actualResult!.trim(),
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (_analysis.doctorNote != null &&
              _analysis.doctorNote!.trim().isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Doktor notu',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              _analysis.doctorNote!.trim(),
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (originalImg != null) ...[
            pw.SizedBox(height: 16),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Orijinal Görsel',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.SizedBox(height: 8),
            pw.Center(
              child: pw.Image(originalImg, height: 280, fit: pw.BoxFit.contain),
            ),
          ],
          if (heatmapImg != null) ...[
            pw.SizedBox(height: 16),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Isı Haritası (Heatmap)',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.SizedBox(height: 8),
            pw.Center(
              child: pw.Image(heatmapImg, height: 280, fit: pw.BoxFit.contain),
            ),
          ],
        ],
      ),
    );
    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
      name: '${kind}_Analiz_$_dateFormatted.pdf',
    );
  }

  Widget _item(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w700,
              fontSize: 12,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF1E293B),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pct = (_analysis.confidence * 100).toStringAsFixed(1);
    final kindRaw = effectiveReportKindFromAnalysis(_analysis) ??
        _inferSingleModalityFromImageUrls(_analysis) ??
        _analysis.reportKind;
    final kind = radiologyModalityDisplayTitle(kindRaw);
    final inf = _parseAiInferenceMap(_analysis.aiInferenceJson);
    final detailWidgets = _clinicalWidgetsFromInferenceMap(inf);

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (ctx, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(
                    Icons.biotech_outlined,
                    size: 20,
                    color: Color(0xFF0A8FB6),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '$kind Radyolojik Rapor',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  _item('Analiz Türü', kind),
                  _item('Tarih', _dateFormatted),
                  _item('AI Sonucu', _analysis.aiResult),
                  _item('Güven Skoru', '%$pct'),
                  if (detailWidgets.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Detaylı açıklama',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: detailWidgets,
                      ),
                    ),
                  ],
                  if (_analysis.drFeedback != null &&
                      _analysis.drFeedback!.isNotEmpty)
                    _item('DR Değerlendirmesi', _analysis.drFeedback!),
                  // ── Orijinal görsel ───────────────────────────────────────
                  if (_analysis.originalImage != null &&
                      _analysis.originalImage!.isNotEmpty &&
                      File(_analysis.originalImage!).existsSync()) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Orijinal Görsel',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(
                        File(_analysis.originalImage!),
                        width: double.infinity,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ],
                  if (_analysis.heatmapUrl != null &&
                      _analysis.heatmapUrl!.isNotEmpty &&
                      _analysis.heatmapUrl!.startsWith('/') &&
                      File(_analysis.heatmapUrl!).existsSync()) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Isı Haritası (Heatmap)',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(
                        File(_analysis.heatmapUrl!),
                        width: double.infinity,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  StructuredDoctorFeedbackForm(
                    initialRecord: _analysis,
                    reportKind: resolvedFeedbackModalityForAnalysis(_analysis),
                    aiSummaryLabel: _radiologyApprovalLabel(),
                    liveResponseBody: null,
                    onSaved: (updated) {
                      setState(() => _analysis = updated);
                      widget.onChanged();
                    },
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('PDF Olarak İndir'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD32F2F),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: _downloadPdf,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Inline Analysis Card ────────────────────────────────────────────────────
// Her modality (Fundus/OCT/FFA) için ayrı state — görsel seçim, yükleme,
// sonuç gösterimi hepsi bu kartın içinde kalır, başka sayfaya geçilmez.
class _InlineAnalysisCard extends StatefulWidget {
  const _InlineAnalysisCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.iconBg,
    required this.iconColor,
    required this.apiEndpoint,
    required this.patientId,
    required this.border,
    required this.transferText,
    required this.onTransfer,
    required this.onClearTransfer,
    required this.onAnalysisSaved,
    this.lastSavedAnalysis,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final Color iconBg;
  final Color iconColor;
  final String apiEndpoint;
  final String patientId;
  final Color border;
  final String transferText;
  final void Function(String text) onTransfer;
  final VoidCallback onClearTransfer;
  final VoidCallback onAnalysisSaved;
  /// Yerelde / sunucudan gelen bu türdeki en son analiz — geri bildirim ve özet için.
  final AnalysisApiModel? lastSavedAnalysis;

  @override
  State<_InlineAnalysisCard> createState() => _InlineAnalysisCardState();
}

class _InlineAnalysisCardState extends State<_InlineAnalysisCard> {
  static const _primary = Color(0xFF0A8FB6);

  XFile? _pickedImage;
  bool _analyzing = false;
  Map<String, dynamic>? _result;
  String? _errorMsg;
  AnalysisApiModel? _persistedRecord;

  @override
  void initState() {
    super.initState();
  }

  @override
  void didUpdateWidget(covariant _InlineAnalysisCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.lastSavedAnalysis?.id != oldWidget.lastSavedAnalysis?.id &&
        _pickedImage == null &&
        _result == null) {
      _persistedRecord = null;
      setState(() {});
    }
  }

  AnalysisApiModel? get _activeFeedbackTarget =>
      _persistedRecord ??
      (_pickedImage == null && _result == null
          ? widget.lastSavedAnalysis
          : null);

  bool get _showRestoredSummary =>
      widget.lastSavedAnalysis != null &&
      _pickedImage == null &&
      _result == null;

  String? get _displayLabel {
    if (_result != null) return _labelFromAiBody(widget.label, _result!);
    if (_showRestoredSummary) return widget.lastSavedAnalysis!.aiResult;
    return null;
  }

  double get _displayConfidence {
    if (_result != null) return _confidenceFromAiBody(widget.label, _result!);
    if (_showRestoredSummary) return widget.lastSavedAnalysis!.confidence;
    return 0;
  }

  Map<String, dynamic>? get _inferencePreviewMap {
    if (_result != null) return _buildInferenceSnapshot(widget.label, _result!);
    if (_showRestoredSummary) {
      return _parseAiInferenceMap(widget.lastSavedAnalysis!.aiInferenceJson);
    }
    return null;
  }

  List<Widget> get _inferenceUiBlocks =>
      _clinicalWidgetsFromInferenceMap(_inferencePreviewMap);

  String? get _heatmapBase64 => _result?['heatmapPlus'] as String?;

  Future<void> _sendToApi(XFile image) async {
    try {
      setState(() {
        _analyzing = true;
        _errorMsg = null;
      });
      final formMap = <String, dynamic>{
        'image': await MultipartFile.fromFile(
          image.path,
          filename: 'image.jpg',
        ),
        'patientId': widget.patientId,
      };
      final ep = widget.apiEndpoint;
      if (ep.contains('/api/ai/predict')) {
        formMap['locale'] = 'tr';
      }
      final formData = FormData.fromMap(formMap);

      final response = await ApiClient.instance.postAi(
        widget.apiEndpoint,
        data: formData,
      );

      if (!mounted) return;
      var body = _normalizeAiResponseBody(response.data);
      body = _mergeAiResponseEnvelope(body);

      setState(() {
        _result = body;
        _analyzing = false;
        _persistedRecord = null;
      });

      // Heatmap base64'ü ve orijinal görseli kalıcı dosyalara kaydet
      final dir = await getApplicationDocumentsDirectory();
      final ts = DateTime.now().millisecondsSinceEpoch;

      // Orijinal görseli kalıcı konuma kopyala
      String? savedOriginalPath;
      try {
        final destFile = File(
          '${dir.path}/orig_${widget.label.toLowerCase()}_$ts.jpg',
        );
        await File(image.path).copy(destFile.path);
        savedOriginalPath = destFile.path;
      } catch (_) {
        savedOriginalPath = image.path; // geçici path'i fallback olarak kullan
      }

      // Heatmap base64'ü dosyaya kaydet
      String? savedHeatmapPath;
      final heatmapRaw = body['heatmapPlus'] as String?;
      if (heatmapRaw != null && heatmapRaw.isNotEmpty) {
        try {
          final b64 = heatmapRaw.contains(',')
              ? heatmapRaw.split(',').last
              : heatmapRaw;
          final bytes = base64Decode(b64);
          final heatFile = File(
            '${dir.path}/heat_${widget.label.toLowerCase()}_$ts.png',
          );
          await heatFile.writeAsBytes(bytes);
          savedHeatmapPath = heatFile.path;
        } catch (_) {}
      }

      AnalysisApiModel? persisted;
      try {
        final label = _labelFromAiBody(widget.label, body);
        final conf = _confidenceFromAiBody(widget.label, body);
        final snapshot = _buildInferenceSnapshot(widget.label, body);
        final enc = jsonEncode(_jsonSanitize(snapshot));
        final savedAnalysis = AnalysisApiModel(
          id: UuidGenerator.generateOfflineId(),
          patientId: widget.patientId,
          aiResult: label ?? 'unknown',
          confidence: conf,
          heatmapUrl: savedHeatmapPath ?? (body['heatmapUrl'] as String?),
          originalImage: savedOriginalPath,
          createdAt: DateTime.now(),
          isSynced: false,
          reportKind: widget.label.toLowerCase(),
          drGradeInt: ((body['drGrade'] ?? body['dr_grade']) as num?)?.toInt(),
          aiInferenceJson: enc,
        );
        persisted = await AnalysisService.instance.add(savedAnalysis);
      } catch (e) {
        debugPrint('Analiz kaydı başarısız: $e');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Analiz gösterildi; kayıt hatası: $e',
                style: GoogleFonts.inter(),
              ),
              backgroundColor: const Color(0xFF93000A),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }

      if (!mounted) return;
      setState(() {
        if (persisted != null) {
          _persistedRecord = persisted;
        }
      });
      widget.onAnalysisSaved();
    } on DioException catch (e) {
      if (!mounted) return;
      String msg;
      if (e.message == kSessionTokenMissingMessage) {
        msg =
            'Oturum açık değil veya süre dolmuş. Çıkış yapıp tekrar giriş yapın.';
      } else if (e.response?.statusCode == 401) {
        final body = e.response?.data;
        final fromServer =
            body is Map ? body['error']?.toString().trim() : null;
        msg = (fromServer != null && fromServer.isNotEmpty)
            ? fromServer
            : 'Oturum doğrulanamadı (401). Tekrar giriş yapın.';
      } else {
        msg = e.response?.data is Map
            ? (e.response!.data as Map)['error']?.toString() ?? 'Sunucu hatası'
            : 'Bağlantı hatası';
      }
      setState(() {
        _analyzing = false;
        _errorMsg = msg.toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _errorMsg = 'Hata: $e';
      });
    }
  }

  Future<void> _pickAndAnalyze() async {
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (image == null || !mounted) return;
      setState(() {
        _pickedImage = image;
        _result = null;
        _errorMsg = null;
      });
      await _sendToApi(image);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _errorMsg = 'Görsel seçilemedi: $e';
      });
    }
  }

  Future<void> _retryAnalysis() async {
    if (_pickedImage == null) return;
    await _sendToApi(_pickedImage!);
  }

  void _reset() {
    setState(() {
      _pickedImage = null;
      _result = null;
      _errorMsg = null;
      _persistedRecord = null;
    });
    widget.onClearTransfer();
  }

  String _approvalLabelForFeedback() {
    if (_result != null) {
      final l = _labelFromAiBody(widget.label, _result!);
      if (l != null && l.isNotEmpty) return l;
    }
    if (_showRestoredSummary) {
      return widget.lastSavedAnalysis?.aiResult ?? '—';
    }
    return _activeFeedbackTarget?.aiResult ?? '—';
  }

  String _feedbackReportKind() {
    final t = _activeFeedbackTarget;
    if (t == null) return widget.label.toLowerCase();
    return (effectiveReportKindFromAnalysis(t) ?? widget.label)
        .toLowerCase();
  }

  void _transfer() {
    final label = _displayLabel;
    if (label == null) return;
    final pct = (_displayConfidence * 100).toStringAsFixed(0);
    final buf = StringBuffer('${widget.label} AI: $label. Güven: %$pct.');
    final extra = _inferencePlainNarration(_inferencePreviewMap);
    if (extra != null && extra.isNotEmpty) {
      buf.writeln();
      buf.writeln(extra);
    }
    widget.onTransfer(buf.toString());
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${widget.label} sonucu rapora aktarıldı.'),
        backgroundColor: const Color(0xFF006645),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _aiSummaryAndDetailsBox({required bool showTransferRow}) {
    final label = _displayLabel;
    if (label == null) return const SizedBox.shrink();
    final modelDr =
        (_persistedRecord?.drFeedback ?? widget.lastSavedAnalysis?.drFeedback ?? '')
            .trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_heatmapBase64 != null && _heatmapBase64!.isNotEmpty) ...[
          Text(
            'Isı Haritası (Heatmap)',
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 4),
          Builder(
            builder: (context) {
              final mem = _decodeHeatmapImageBytes(_heatmapBase64);
              if (mem == null) return const SizedBox.shrink();
              return ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.memory(
                  mem,
                  width: double.infinity,
                  height: 180,
                  fit: BoxFit.cover,
                ),
              );
            },
          ),
          const SizedBox(height: 10),
        ],
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFE3F2FD),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF90CAF9)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.auto_awesome,
                    size: 15,
                    color: Color(0xFF1565C0),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'AI Sonucu',
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1565C0),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: GoogleFonts.manrope(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0D47A1),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Güven: %${(_displayConfidence * 100).toStringAsFixed(1)}',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: const Color(0xFF1565C0),
                ),
              ),
              if (modelDr.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  'DR / model notu',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF1565C0),
                  ),
                ),
                Text(
                  modelDr,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF1E293B),
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (_inferenceUiBlocks.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            'Detaylı açıklama',
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _inferenceUiBlocks,
            ),
          ),
        ],
        if (_activeFeedbackTarget != null)
          StructuredDoctorFeedbackForm(
            initialRecord: _activeFeedbackTarget!,
            reportKind: _feedbackReportKind(),
            aiSummaryLabel: _approvalLabelForFeedback(),
            liveResponseBody: _result,
            onSaved: (updated) {
              setState(() => _persistedRecord = updated);
              widget.onAnalysisSaved();
            },
          ),
        if (showTransferRow) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  icon: const Icon(Icons.arrow_circle_right_outlined, size: 15),
                  label: Text(
                    widget.transferText.isEmpty
                        ? 'Rapora aktar'
                        : 'Rapora eklendi ✓',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: widget.transferText.isEmpty
                        ? const Color(0xFF0A8FB6)
                        : const Color(0xFF2E7D32),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: widget.transferText.isEmpty ? _transfer : null,
                ),
              ),
              if (_pickedImage != null) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.refresh, size: 14),
                  label: Text(
                    'Yeni',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF64748B),
                    side: const BorderSide(color: Color(0xFFCFD8DC)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    padding: const EdgeInsets.symmetric(
                      vertical: 10,
                      horizontal: 12,
                    ),
                  ),
                  onPressed: _reset,
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: widget.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: widget.iconBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(widget.icon, size: 18, color: widget.iconColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.label,
                      style: GoogleFonts.manrope(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                    Text(
                      widget.subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF5D6B82),
                      ),
                    ),
                  ],
                ),
              ),
              if (_pickedImage != null)
                GestureDetector(
                  onTap: _reset,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFFC62828),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Yükleme butonu ya da loading
          if (_pickedImage == null) ...[
            if (_showRestoredSummary) ...[
              Text(
                'Kayıtlı son analiz',
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 8),
              _aiSummaryAndDetailsBox(showTransferRow: true),
              const SizedBox(height: 14),
            ],
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.upload_rounded, size: 15),
                label: Text(
                  'Görsel Yükle',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _primary,
                  side: const BorderSide(color: _primary),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: _pickAndAnalyze,
              ),
            ),
          ] else ...[
            // Seçilen görsel
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.file(
                File(_pickedImage!.path),
                width: double.infinity,
                height: 180,
                fit: BoxFit.cover,
              ),
            ),

            // Yükleniyor animasyonu
            if (_analyzing) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'AI analiz ediliyor...',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],

            // Hata mesajı
            if (_errorMsg != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFEF9A9A)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 16,
                      color: Color(0xFFC62828),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMsg!,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: const Color(0xFFC62828),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.refresh, size: 14),
                label: Text(
                  'Tekrar Dene',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _primary,
                  side: const BorderSide(color: _primary),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _retryAnalysis,
              ),
            ],

            // Sonuç (özet + detay + doktor geri bildirimi + forma aktar)
            if (_result != null && !_analyzing) ...[
              const SizedBox(height: 10),
              _aiSummaryAndDetailsBox(showTransferRow: true),
            ],
          ],

          // Aktarılmış metin göstergesi
          if (widget.transferText.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 16,
                    color: Color(0xFF2E7D32),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.transferText,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF1B5E20),
                        height: 1.5,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: widget.onClearTransfer,
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFF4CAF50),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
