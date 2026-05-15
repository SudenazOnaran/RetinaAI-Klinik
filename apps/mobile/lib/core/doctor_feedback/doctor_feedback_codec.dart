import 'dart:convert';

/// Web `@/lib/doctor-feedback.ts` ve `@/lib/ffa-doctor-feedback-json.ts` ile uyumlu tokenlar.

const String kModalityDisagreePending = '__m_df_pending__';
const String kModalityDoctorApprovalValue = 'ai_sonucu_dogru';
const String kMaiPrefix = 'mai:';
const String kOctMultiPrefix = 'oct_multi:';
const String kFfaJsonPrefix = 'ffa_json:';

const String kOctHealthyValue = 'oct_saglikli_makula';
const String kFfaHealthyValue = 'ffa_healthy';

/// Web `DR_STAGE_LABELS_TR` ile aynı sırada / metin (boşluklar dahil).
const List<String> kDrStageLabelsTr = [
  'Evre 0 (Sağlıklı - No DR)',
  'Evre 1 (Hafif - Mild NPDR)  ',
  'Evre 2 (Orta - Moderate NPDR) ',
  'Evre 3 (Şiddetli - Severe NPDR):',
  'Evre 4 (Proliferatif - PDR)',
];

final Set<String> _approvalKeys = {
  'ai_sonucu_dogru',
  'ai_dogru',
  'dogru',
  'evet',
  'yes',
  'correct',
};

final List<({String value, List<String> match})> kOctDisagreeStatic = [
  (value: 'oct_dme', match: ['dme', 'diabetik', 'edema', 'ödem', 'odem']),
  (value: 'oct_amd', match: ['amd', 'dejener', 'yşa', 'macular degeneration', 'neovas']),
  (value: 'oct_macular_hole', match: ['hole', 'delik', 'macular hole', 'makula delik']),
  (value: 'oct_erm', match: ['erm', 'vmt', 'vitreo', 'epiretinal', 'yapış', 'traksiyon']),
];

final List<({String value, List<String> match})> kFfaDiseaseStatic = [
  (value: kFfaHealthyValue, match: []),
  (value: 'ffa_dr', match: ['diabet', 'retinopati', 'npdr', 'pdr', 'dr', 'dme']),
  (value: 'ffa_rvo', match: ['rvo', 'ven', 'tıkan', 'branch', 'crao', 'occlusion']),
  (value: 'ffa_amd_cnv', match: ['amd', 'cnv', 'neovas', 'koroidal', 'macula']),
  (value: 'ffa_csr', match: ['csr', 'seröz', 'santral seröz', 'cscr']),
  (value: 'ffa_uveitis', match: ['üveit', 'uveit', 'vaskülit', 'retinal vask', 'vaskulit']),
];

String _normalizeDiseaseName(String s) {
  return s
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceAll(RegExp(r'[ıi]'), 'i');
}

String _normalizeRiskKey(String value) {
  var s = value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
  s = s.replaceAll('ı', 'i').replaceAll('ç', 'c').replaceAll('ğ', 'g');
  s = s.replaceAll('ö', 'o').replaceAll('ş', 's').replaceAll('ü', 'u');
  return s;
}

bool isModalityDisagreePending(String? raw) =>
    raw != null && raw.trim() == kModalityDisagreePending;

String? decodeModalityAiAlignedLabel(String? raw) {
  final t = raw?.trim() ?? '';
  if (!t.startsWith(kMaiPrefix)) return null;
  final rest = t.substring(kMaiPrefix.length).trim();
  return rest.isEmpty ? null : rest;
}

String encodeModalityAiAlignedLabel(String label) {
  final s = label.trim();
  if (s.isEmpty) return kModalityDoctorApprovalValue;
  return '$kMaiPrefix$s';
}

bool isDoctorApprovalToken(String? raw) {
  final trimmed = raw?.trim() ?? '';
  if (trimmed.isEmpty) return false;
  if (decodeModalityAiAlignedLabel(trimmed) != null) return true;
  return _approvalKeys.contains(_normalizeRiskKey(trimmed));
}

String encodeOctMultiSelection(Iterable<String> values) {
  final uniq = {...values.map((e) => e.trim()).where((e) => e.isNotEmpty)};
  if (uniq.isEmpty) return '';
  return '$kOctMultiPrefix${uniq.join(',')}';
}

List<String> decodeOctMultiSelection(String? raw) {
  final t = raw?.trim() ?? '';
  if (!t.startsWith(kOctMultiPrefix)) return [];
  final rest = t.substring(kOctMultiPrefix.length).trim();
  if (rest.isEmpty) return [];
  return {...rest.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty)}.toList();
}

/// AI OCT `conditions` ile sabit kodları birleştirir (web `mergeOctStaticWithAiConditions`).
List<({String value, String valueKey})> mergeOctStaticWithAiConditions(
  List<Map<String, dynamic>>? conditions,
) {
  final byToken = <String, Map<String, String>>{};
  for (final c in conditions ?? const []) {
    final name = c['name']?.toString().trim() ?? '';
    if (name.isEmpty) continue;
    final n = _normalizeDiseaseName(name);
    for (final row in kOctDisagreeStatic) {
      if (row.match.any((m) => n.contains(m) || m.contains(n))) {
        byToken.putIfAbsent(row.value, () => {'likelihood': '${c['likelihood']}', 'name': name});
        break;
      }
    }
  }
  return kOctDisagreeStatic
      .map((row) => (value: row.value, valueKey: row.value))
      .toList();
}

/// FFA `diseases` ile sabit kodları birleştirir.
List<({String value, String valueKey})> mergeFfaStaticWithDiseases(
  List<Map<String, dynamic>>? diseases,
) {
  final byToken = <String, Map<String, String>>{};
  for (final c in diseases ?? const []) {
    final name = c['name']?.toString().trim() ?? '';
    if (name.isEmpty) continue;
    final n = _normalizeDiseaseName(name);
    for (final row in kFfaDiseaseStatic) {
      if (row.value == kFfaHealthyValue) continue;
      if (row.match.any((m) => n.contains(m))) {
        byToken.putIfAbsent(row.value, () => {'likelihood': '${c['likelihood']}', 'name': name});
        break;
      }
    }
  }
  return kFfaDiseaseStatic
      .map((row) => (value: row.value, valueKey: row.value))
      .toList();
}

String? modalityOctFeedbackForStorage(String? raw) {
  final t = raw?.trim() ?? '';
  if (t.isEmpty || isModalityDisagreePending(t)) return null;
  return t;
}

String? modalityFfaFeedbackForStorage(String? raw) {
  final t = raw?.trim() ?? '';
  if (t.isEmpty || isModalityDisagreePending(t)) return null;
  return t;
}

/// Web `ffa_json:` v3 yükü.
String encodeFfaDoctorFeedbackV3({
  required List<String> diagnoses,
  String? drStage,
  bool nvd = false,
  bool nve = false,
}) {
  final payload = <String, dynamic>{
    'v': 3,
    'diagnoses': diagnoses,
    'drStage': drStage,
    'nvd': nvd,
    'nve': nve,
  };
  return '$kFfaJsonPrefix${jsonEncode(payload)}';
}

Map<String, dynamic>? tryParseFfaDoctorFeedbackAny(String? raw) {
  final t = raw?.trim() ?? '';
  if (!t.startsWith(kFfaJsonPrefix)) return null;
  try {
    final o = jsonDecode(t.substring(kFfaJsonPrefix.length)) as Map<String, dynamic>?;
    if (o == null) return null;
    final ver = o['v'];
    if (ver == 3 &&
        o['diagnoses'] is List &&
        (o['diagnoses'] as List).every((x) => x is String)) {
      return o;
    }
    if (ver == 2 && o['diagnosis'] is String) {
      return o;
    }
  } catch (_) {}
  return null;
}

int? getDrStageIndexFromLabel(String? value) {
  if (value == null) return null;
  final raw = value.trim();
  if (raw.isEmpty) return null;
  for (var i = 0; i < kDrStageLabelsTr.length; i++) {
    final tr = kDrStageLabelsTr[i];
    if (raw == tr || raw == tr.trim()) return i;
  }
  final key = _normalizeRiskKey(raw);
  if (['no_dr', 'no.dr', 'healthy', 'saglikli', 'none', 'normal'].contains(key)) {
    return 0;
  }
  if (['mild', 'hafif', 'hafif_evre', 'dusuk_risk'].contains(key)) return 1;
  if (['moderate', 'orta', 'orta_evre', 'orta_risk', 'medium'].contains(key)) {
    return 2;
  }
  if ([
    'severe',
    'agir',
    'agir_evre',
    'agir_risk',
    'yuksek_risk',
    'high_risk',
    'high',
    'ciddi',
  ].contains(key)) {
    return 3;
  }
  if ([
    'proliferative',
    'proliferatif',
    'pdr',
    'neo',
    'neovascular',
  ].contains(key)) {
    return 4;
  }
  return null;
}

String octTurkishLabel(String value) {
  switch (value) {
    case 'oct_dme':
      return 'DME / diyabetik maküler ödem';
    case 'oct_amd':
      return 'AMD / makula dejenerasyonu';
    case 'oct_macular_hole':
      return 'Maküler delik';
    case 'oct_erm':
      return 'ERM / VMT / epiretinal membran';
    case kOctHealthyValue:
      return 'Sağlıklı maküla (anjiyografide belirgin patoloji yok)';
    default:
      return value;
  }
}

String ffaTurkishLabel(String value) {
  switch (value) {
    case kFfaHealthyValue:
      return 'Belirgin patoloji yok (sağlıklı)';
    case 'ffa_dr':
      return 'Diyabetik retinopati (FFA-DR)';
    case 'ffa_rvo':
      return 'Retinal ven oklüzyonu (RVO)';
    case 'ffa_amd_cnv':
      return 'AMD / CNV';
    case 'ffa_csr':
      return 'Santral seröz / CSR';
    case 'ffa_uveitis':
      return 'Üveitis / vaskülit';
    default:
      return value;
  }
}
