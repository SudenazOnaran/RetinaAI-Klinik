import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../../data/local/secure_storage.dart';

/// Bazı reverse proxy yapılandırmaları `Authorization` iletmez; Next.js bunu da okur.
const String kMobileSessionHeader = 'X-Retina-Mobile-Token';

/// [postAi] token yokken `DioException.message` ile taşınır; `patient_detail` vb. yerlerde Türkçeleştirilir.
const String kSessionTokenMissingMessage = 'SESSION_TOKEN_MISSING';

/// Tüm API isteklerini yöneten Dio tabanlı HTTP client.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  late final Dio _dio;

  void init() {
    // Content-Type burada verilmez: FormData (AI multipart) ile çakışır.
    // JSON isteklerde Dio, Map gövdesi için application/json ekler.
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: ApiConstants.connectTimeout),
        receiveTimeout: const Duration(seconds: ApiConstants.receiveTimeout),
      ),
    );

    _dio.interceptors.add(_AuthInterceptor());
    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        requestHeader: false,
        responseHeader: false,
      ),
    );
  }

  // --- GET ---
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    return _dio.get(path, queryParameters: queryParameters);
  }

  // --- POST ---
  Future<Response> post(String path, {dynamic data}) {
    return _dio.post(path, data: data);
  }

  // --- POST (AI) — 120s timeout; Bearer açıkça eklenir (multipart + interceptor edge-case). ---
  Future<Response> postAi(String path, {dynamic data}) async {
    final raw = await SecureStorageService.instance.getToken();
    final normalized = _normalizeBearerToken(raw);
    if (normalized == null || normalized.isEmpty) {
      throw DioException(
        requestOptions: RequestOptions(path: path, baseUrl: _dio.options.baseUrl),
        type: DioExceptionType.unknown,
        message: kSessionTokenMissingMessage,
      );
    }
    // İstek başına net: multipart + proxy senaryolarında çift yedek başlık.
    final headers = <String, dynamic>{
      'Authorization': 'Bearer $normalized',
      kMobileSessionHeader: normalized,
    };
    return _dio.post(
      path,
      data: data,
      options: Options(
        connectTimeout: const Duration(seconds: ApiConstants.aiReceiveTimeout),
        receiveTimeout: const Duration(seconds: ApiConstants.aiReceiveTimeout),
        headers: headers,
      ),
    );
  }

  // --- PATCH ---
  Future<Response> patch(String path, {dynamic data}) {
    return _dio.patch(path, data: data);
  }

  // --- DELETE ---
  Future<Response> delete(String path) {
    return _dio.delete(path);
  }
}

String? _normalizeBearerToken(String? token) {
  if (token == null) return null;
  var t = token.trim();
  if (t.isEmpty) return null;
  final lower = t.toLowerCase();
  if (lower.startsWith('bearer ')) {
    t = t.substring(7).trim();
  }
  return t.isEmpty ? null : t;
}

/// Her isteğe Authorization ve mobil yedek başlığını ekler.
class _AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final normalized = _normalizeBearerToken(
      await SecureStorageService.instance.getToken(),
    );
    if (normalized != null && normalized.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $normalized';
      options.headers[kMobileSessionHeader] = normalized;
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // 401 geldiğinde token'ı SİLME — bu cascade hataya yol açar.
    // Kullanıcı hata mesajı görür, tekrar giriş yapabilir.
    handler.next(err);
  }
}
