import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../models/calendar_event_model.dart';

/// Spec §8.1 — Calendar CRUD via /api/doctor/calendar.
class CalendarRepository {
  CalendarRepository._();
  static final CalendarRepository instance = CalendarRepository._();

  final _api = ApiClient.instance;

  /// Fetch events for a given month (YYYY-MM).
  Future<List<CalendarEventModel>> getByMonth(String month) async {
    final response = await _api.get(
      ApiConstants.calendar,
      queryParameters: {'month': month},
    );
    final data = response.data as Map<String, dynamic>;
    final list = (data['events'] as List?) ?? [];
    return list
        .map((e) => CalendarEventModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Create a new calendar event. Returns the created event.
  Future<CalendarEventModel> create({
    required String dateKey,
    required String time,
    required String title,
    required String note,
  }) async {
    final response = await _api.post(
      ApiConstants.calendar,
      data: {'dateKey': dateKey, 'time': time, 'title': title, 'note': note},
    );
    final data = response.data as Map<String, dynamic>;
    return CalendarEventModel.fromJson(
      data['event'] as Map<String, dynamic>,
    );
  }

  /// Update an existing event (title and/or note).
  Future<CalendarEventModel> update({
    required String id,
    String? title,
    String? note,
    String? time,
  }) async {
    final response = await _api.patch(
      ApiConstants.calendar,
      data: {
        'id': id,
        if (title != null) 'title': title,
        if (note != null) 'note': note,
        if (time != null) 'time': time,
      },
    );
    final data = response.data as Map<String, dynamic>;
    return CalendarEventModel.fromJson(
      data['event'] as Map<String, dynamic>,
    );
  }

  /// Delete an event by id.
  Future<void> delete(String id) async {
    await _api.delete('${ApiConstants.calendar}?id=$id');
  }
}
