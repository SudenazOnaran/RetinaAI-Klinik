import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/calendar_service.dart';
import '../../data/models/calendar_event_model.dart';

class CalendarState {
  final List<CalendarEventModel> events;
  final bool isLoading;
  final String? error;
  final String currentMonth; // YYYY-MM

  const CalendarState({
    this.events = const [],
    this.isLoading = false,
    this.error,
    required this.currentMonth,
  });

  CalendarState copyWith({
    List<CalendarEventModel>? events,
    bool? isLoading,
    String? error,
    String? currentMonth,
  }) {
    return CalendarState(
      events: events ?? this.events,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      currentMonth: currentMonth ?? this.currentMonth,
    );
  }
}

final calendarProvider =
    StateNotifierProvider<CalendarNotifier, CalendarState>((ref) {
  final now = DateTime.now();
  final month =
      '${now.year}-${now.month.toString().padLeft(2, '0')}';
  return CalendarNotifier(initialMonth: month);
});

class CalendarNotifier extends StateNotifier<CalendarState> {
  CalendarNotifier({required String initialMonth})
      : super(CalendarState(currentMonth: initialMonth)) {
    loadMonth(initialMonth);
  }

  final _service = CalendarService.instance;

  Future<void> loadMonth(String month) async {
    state = state.copyWith(isLoading: true, error: null, currentMonth: month);
    try {
      final events = await _service.getByMonth(month);
      state = state.copyWith(events: events, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> createEvent({
    required String dateKey,
    required String time,
    required String title,
    required String note,
  }) async {
    final event = await _service.create(
      dateKey: dateKey,
      time: time,
      title: title,
      note: note,
    );
    state = state.copyWith(events: [...state.events, event]);
  }

  Future<void> updateEvent({
    required String id,
    String? title,
    String? note,
    String? time,
  }) async {
    final updated =
        await _service.update(id: id, title: title, note: note, time: time);
    state = state.copyWith(
      events: state.events.map((e) => e.id == id ? updated : e).toList(),
    );
  }

  Future<void> deleteEvent(String id) async {
    await _service.delete(id);
    state = state.copyWith(
      events: state.events.where((e) => e.id != id).toList(),
    );
  }

  List<CalendarEventModel> eventsForDay(String dateKey) {
    return state.events.where((e) => e.dateKey == dateKey).toList()
      ..sort((a, b) => a.time.compareTo(b.time));
  }
}
