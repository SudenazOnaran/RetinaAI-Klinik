/// Spec §8.1 — CalendarEvent model.
class CalendarEventModel {
  final String id;
  final String doctorId;
  final String dateKey; // YYYY-MM-DD
  final String time; // HH:MM
  final String title;
  final String note;
  final DateTime createdAt;
  final DateTime updatedAt;

  const CalendarEventModel({
    required this.id,
    required this.doctorId,
    required this.dateKey,
    required this.time,
    required this.title,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CalendarEventModel.fromJson(Map<String, dynamic> json) {
    return CalendarEventModel(
      id: json['id'] as String,
      doctorId: json['doctorId'] as String,
      dateKey: json['dateKey'] as String,
      time: json['time'] as String,
      title: json['title'] as String,
      note: json['note'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dateKey': dateKey,
      'time': time,
      'title': title,
      'note': note,
    };
  }
}
