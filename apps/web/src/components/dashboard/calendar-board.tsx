"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/providers/i18n-provider";

type CalendarNote = {
  id: string;
  dateKey: string;
  time: string;
  title: string;
  note: string;
  createdAt: string;
};

type CalendarBoardProps = {
  doctorId: string;
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function getMonthLabel(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    month: "long",
    year: "numeric",
  });
}

function getCalendarGrid(monthDate: Date): Date[] {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayIndex = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - mondayIndex);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

function formatDisplayDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function fetchCalendarNotes(monthDate: Date): Promise<CalendarNote[]> {
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const res = await fetch(`/api/doctor/calendar?month=${month}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Calendar data fetch failed");
  }

  const data = (await res.json()) as { events?: CalendarNote[] };
  return Array.isArray(data.events) ? data.events : [];
}

export function CalendarBoard({ doctorId }: CalendarBoardProps) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthDate, setMonthDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const today = new Date();
    setSelectedDate(today);
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }, [doctorId]);

  useEffect(() => {
    if (!monthDate) return;

    const load = async () => {
      setIsLoadingNotes(true);
      try {
        const events = await fetchCalendarNotes(monthDate);
        setNotes(events);
      } catch {
        toast({
          variant: "destructive",
          title: t("errorPage.title"),
          description: t("calendarClient.toastLoadFail"),
        });
      } finally {
        setIsLoadingNotes(false);
      }
    };

    void load();
  }, [monthDate, toast]);

  const selectedDateKey = useMemo(() => {
    if (!selectedDate) return "";
    return toDateKey(selectedDate);
  }, [selectedDate]);

  const notesByDateKey = useMemo(() => {
    const map = new Map<string, CalendarNote[]>();

    for (const note of notes) {
      const list = map.get(note.dateKey) ?? [];
      list.push(note);
      map.set(note.dateKey, list);
    }

    for (const [key, list] of map.entries()) {
      map.set(
        key,
        [...list].sort((a, b) => a.time.localeCompare(b.time)),
      );
    }

    return map;
  }, [notes]);

  const selectedDateNotes = useMemo(
    () => notesByDateKey.get(selectedDateKey) ?? [],
    [notesByDateKey, selectedDateKey],
  );

  const isEditing = Boolean(editingNoteId);
  const hasTimeConflict = useMemo(() => {
    if (!time) return false;
    return selectedDateNotes.some(
      (item) => item.time === time && item.id !== editingNoteId,
    );
  }, [selectedDateNotes, time, editingNoteId]);

  const monthGrid = useMemo(() => {
    if (!monthDate) return [];
    return getCalendarGrid(monthDate);
  }, [monthDate]);

  const resetForm = () => {
    setTitle("");
    setTime("");
    setNoteText("");
    setEditingNoteId(null);
  };

  const startEditNote = (item: CalendarNote) => {
    setEditingNoteId(item.id);
    setTime(item.time);
    setTitle(item.title);
    setNoteText(item.note);
  };

  const handleUpdateNote = async (
    id: string,
    cleanTitle: string,
    cleanNote: string,
  ) => {
    const res = await fetch("/api/doctor/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        dateKey: selectedDateKey,
        time,
        title: cleanTitle,
        note: cleanNote,
      }),
    });

    if (res.status === 409) {
      toast({
        variant: "destructive",
        title: t("calendarClient.timeConflictTitle"),
        description: t("calendarClient.timeConflictDesc"),
      });
      return;
    }

    if (!res.ok) {
      throw new Error("Calendar record update failed");
    }

    const data = (await res.json()) as { event?: CalendarNote };
    if (data.event) {
      setNotes((prev) =>
        prev.map((item) =>
          item.id === id ? (data.event as CalendarNote) : item,
        ),
      );
    }

    resetForm();

    toast({
      title: t("calendarClient.toastUpdatedTitle"),
      description: t("calendarClient.toastUpdatedDesc"),
    });
  };

  const handleSaveNote = async () => {
    const cleanTitle = title.trim();
    const cleanNote = noteText.trim();

    if (!cleanTitle || !cleanNote || !time) {
      toast({
        variant: "destructive",
        title: t("calendarClient.missingFieldsTitle"),
        description: t("calendarClient.missingFieldsDesc"),
      });
      return;
    }

    if (hasTimeConflict) {
      toast({
        variant: "destructive",
        title: t("calendarClient.timeConflictTitle"),
        description: t("calendarClient.timeConflictDesc"),
      });
      return;
    }

    try {
      if (editingNoteId) {
        await handleUpdateNote(editingNoteId, cleanTitle, cleanNote);
        return;
      }

      const res = await fetch("/api/doctor/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKey: selectedDateKey,
          time,
          title: cleanTitle,
          note: cleanNote,
        }),
      });

      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: t("calendarClient.timeConflictTitle"),
          description: t("calendarClient.timeConflictDesc"),
        });
        return;
      }

      if (!res.ok) {
        throw new Error("Calendar record create failed");
      }

      const data = (await res.json()) as { event?: CalendarNote };
      if (data.event) {
        setNotes((prev) => [...prev, data.event as CalendarNote]);
      }
      resetForm();

      toast({
        title: t("calendarClient.toastCreatedTitle"),
        description: t("calendarClient.toastCreatedDesc"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: isEditing
          ? t("calendarClient.toastUpdateFail")
          : t("calendarClient.toastCreateFail"),
      });
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const res = await fetch("/api/doctor/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        throw new Error("Calendar record delete failed");
      }

      if (editingNoteId === id) {
        resetForm();
      }

      setNotes((prev) => prev.filter((item) => item.id !== id));

      toast({
        title: t("calendarClient.toastDeletedTitle"),
        description: t("calendarClient.toastDeletedDesc"),
      });
    } catch {
      toast({
        variant: "destructive",
        title: t("errorPage.title"),
        description: t("calendarClient.toastDeleteFail"),
      });
    }
  };

  const openDayPanel = (date: Date) => {
    setSelectedDate(date);
    setIsPanelOpen(true);
  };

  const goPrevMonth = () => {
    if (!monthDate) return;
    setMonthDate(
      new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1),
    );
  };

  const goNextMonth = () => {
    if (!monthDate) return;
    setMonthDate(
      new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1),
    );
  };

  if (!selectedDate || !monthDate) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 text-sm text-slate-600">
          {t("calendarClient.loading")}
        </CardContent>
      </Card>
    );
  }

  if (isLoadingNotes) {
    return (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 text-sm text-slate-600">
          {t("calendarClient.loading")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-10.5rem)] min-h-[680px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-slate-900">
            <CalendarClock className="h-5 w-5 text-[var(--retina-primary)]" />
            <h2 className="text-lg font-bold capitalize md:text-xl">
              {getMonthLabel(monthDate, locale)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:px-3">
          {[
            t("calendarClient.weekdays.mon"),
            t("calendarClient.weekdays.tue"),
            t("calendarClient.weekdays.wed"),
            t("calendarClient.weekdays.thu"),
            t("calendarClient.weekdays.fri"),
            t("calendarClient.weekdays.sat"),
            t("calendarClient.weekdays.sun"),
          ].map((label) => (
            <div key={label} className="px-2 py-1 text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="grid h-full grid-cols-7 grid-rows-6">
          {monthGrid.map((day) => {
            const dateKey = toDateKey(day);
            const dayNotes = notesByDateKey.get(dateKey) ?? [];
            const inCurrentMonth = isSameMonth(day, monthDate);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => openDayPanel(day)}
                className={`group flex min-h-[110px] flex-col border-r border-t border-slate-200 p-2 text-left transition-colors last:border-r-0 md:min-h-[120px] md:p-2.5 ${
                  inCurrentMonth
                    ? "bg-white hover:bg-slate-50"
                    : "bg-slate-50/70 text-slate-400 hover:bg-slate-100/70"
                } ${isSelected ? "ring-2 ring-inset ring-[var(--retina-primary)]" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                      isToday
                        ? "bg-[var(--retina-primary)] text-white"
                        : "text-slate-700"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayNotes.length > 0 && (
                    <Badge className="h-5 bg-[#edf5ff] px-1.5 text-[10px] text-[var(--retina-primary)] hover:bg-[#edf5ff]">
                      {dayNotes.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 overflow-hidden">
                  {dayNotes.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="truncate rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-medium text-slate-700"
                    >
                      {task.time} {task.title}
                    </div>
                  ))}
                  {dayNotes.length > 3 && (
                    <p className="text-[10px] font-medium text-slate-500">
                      {t("calendarClient.moreTasks", { count: dayNotes.length - 3 })}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <NotebookPen className="h-5 w-5 text-[var(--retina-accent)]" />
              {formatDisplayDate(selectedDate, locale)}
            </DialogTitle>
            <DialogDescription>
              {t("calendarClient.dialogDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="border-slate-300"
              />
              <Input
                placeholder={t("calendarClient.taskTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-slate-300"
              />
            </div>

            <Textarea
              placeholder={t("calendarClient.taskDetail")}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[110px] border-slate-300"
            />

            {hasTimeConflict && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("calendarClient.timeConflictHint")}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveNote}
                className="w-full bg-[var(--retina-primary)] text-white hover:bg-[var(--retina-primary-deep)]"
              >
                {isEditing ? (
                  <>
                    <Pencil className="mr-2 h-4 w-4" /> {t("calendarClient.updateTask")}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> {t("calendarClient.addTask")}
                  </>
                )}
              </Button>

              {isEditing && (
                <Button variant="outline" onClick={resetForm}>
                  {t("calendarClient.cancel")}
                </Button>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {selectedDateNotes.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {t("calendarClient.emptyDay")}
                </p>
              ) : (
                selectedDateNotes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          {item.time}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.note}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                          onClick={() => startEditNote(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => handleDeleteNote(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
