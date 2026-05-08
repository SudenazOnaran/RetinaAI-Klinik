import '../data/repositories/calendar_repository.dart';
import '../data/models/calendar_event_model.dart';

export '../data/models/calendar_event_model.dart';

/// Calendar service — exposes CalendarRepository to providers.
class CalendarService {
  CalendarService._();
  static final CalendarService instance = CalendarService._();

  final _repo = CalendarRepository.instance;

  Future<List<CalendarEventModel>> getByMonth(String month) =>
      _repo.getByMonth(month);

  Future<CalendarEventModel> create({
    required String dateKey,
    required String time,
    required String title,
    required String note,
  }) => _repo.create(
        dateKey: dateKey,
        time: time,
        title: title,
        note: note,
      );

  Future<CalendarEventModel> update({
    required String id,
    String? title,
    String? note,
    String? time,
  }) => _repo.update(id: id, title: title, note: note, time: time);

  Future<void> delete(String id) => _repo.delete(id);
}
