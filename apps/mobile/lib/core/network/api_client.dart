import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../../data/local/secure_storage.dart';

/// Tüm API isteklerini yöneten Dio tabanlı HTTP client.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  late final Dio _dio;

  void init() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: ApiConstants.connectTimeout),
        receiveTimeout: const Duration(seconds: ApiConstants.receiveTimeout),
        headers: {'Content-Type': 'application/json'},
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

  // --- POST (AI) — 120s timeout ---
  Future<Response> postAi(String path, {dynamic data}) {
    return _dio.post(
      path,
      data: data,
      options: Options(
        receiveTimeout: const Duration(seconds: ApiConstants.aiReceiveTimeout),
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

/// Her isteğe Authorization header ekler; 401 durumunda token temizler.
class _AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await SecureStorageService.instance.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token geçersiz - secure storage temizle
      SecureStorageService.instance.clearAll();
    }
    handler.next(err);
  }
}
