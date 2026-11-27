import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  addDays,
  addMonths,
  format,
  getDay,
  parse,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import type { ChangeEvent, CSSProperties } from "react";

import {
  CalendarDays,
  Check,
  Download,
  FileUp,
  Loader2,
  Pencil,
  Pill,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import {
  MedicationReminder,
  getMedicationRemindersByUser,
  createMedicationReminder,
  deleteMedicationReminder,
  updateMedicationReminder,
} from "@/lib/medications";
import {
  AppointmentReminder,
  getAppointmentRemindersByUser,
  createAppointmentReminder,
  deleteAppointmentReminder,
  updateAppointmentReminder,
} from "@/lib/appointmentReminders";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomTimePicker } from "@/components/ui/time-picker";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_DAY = 90;

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "medication" | "appointment";
  dosage?: string | null;
  recurrence?: string | null;
};

type EventType = "medication" | "appointment";

type ImportedEvent = {
  summary: string;
  dtstart: string;
  dtend: string;
};

const recurrenceOptions = [
  { label: "As needed", value: "As Needed" },
  { label: "Daily", value: "Daily" },
  { label: "Weekly", value: "Weekly" },
  { label: "Every two weeks", value: "Biweekly" },
  { label: "Monthly", value: "Monthly" },
];

function expandMedication(
  medication: MedicationReminder,
  horizonDays = ITEMS_PER_DAY,
): CalendarEvent[] {
  const baseTime = new Date(medication.reminder_time);

  if (Number.isNaN(baseTime.getTime())) {
    return [];
  }

  const recurrence = (medication.recurrence ?? "")
    .toLowerCase()
    .replace(/[-\s]+/g, " ")
    .trim();

  const createEvent = (date: Date, index: number): CalendarEvent => ({
    id: `med-${medication.id}-${index}`,
    title: medication.medication_name,
    start: new Date(date),
    end: new Date(date.getTime() + 15 * 60 * 1000),
    type: "medication",
    dosage: medication.dosage,
    recurrence: medication.recurrence,
  });

  if (!recurrence || recurrence === "as needed") {
    return [createEvent(baseTime, 0)];
  }

  const endPoint = addDays(baseTime, horizonDays);
  const events: CalendarEvent[] = [];

  if (recurrence === "monthly") {
    let current = new Date(baseTime);
    let index = 0;

    while (current <= endPoint) {
      events.push(createEvent(current, index));
      index += 1;
      current = addMonths(current, 1);
    }

    return events;
  }

  const interval =
    recurrence === "weekly" ? 7 : recurrence === "biweekly" ? 14 : 1;

  let current = new Date(baseTime);
  let index = 0;

  while (current <= endPoint) {
    events.push(createEvent(current, index));
    index += 1;
    current = addDays(current, interval);
  }

  return events;
}

function makeAppointmentEvent(
  appointment: AppointmentReminder,
): CalendarEvent {
  const start = new Date(appointment.date);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    id: `appt-${appointment.id}`,
    title: appointment.appointment_name,
    start,
    end,
    type: "appointment",
  };
}

function getMedicationId(eventId: string): string {
  const withoutPrefix = eventId.slice(4);
  const lastDash = withoutPrefix.lastIndexOf("-");

  return lastDash === -1
    ? withoutPrefix
    : withoutPrefix.slice(0, lastDash);
}

function formatUtcDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function generateIcs(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//SymptomSync//Calendar//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:SymptomSync Calendar",
  ];

  const timestamp = formatUtcDate(new Date());

  events.forEach((event) => {
    const summary =
      event.type === "medication"
        ? `Med: ${event.title}`
        : `Appt: ${event.title}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@symptomsync.com`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${formatUtcDate(event.start)}`,
      `DTEND:${formatUtcDate(event.end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

function normalizeIcsDate(value: string): string {
  const match =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute, second, timezone] = match;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone || "Z"}`;
}

function parseIcs(icsText: string): ImportedEvent[] {
  const events: ImportedEvent[] = [];
  const lines = icsText.split(/\r?\n/);

  let currentEvent: Partial<ImportedEvent> = {};
  let insideEvent = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      insideEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      insideEvent = false;

      if (
        currentEvent.summary &&
        currentEvent.dtstart &&
        currentEvent.dtend
      ) {
        events.push({
          summary: currentEvent.summary,
          dtstart: currentEvent.dtstart,
          dtend: currentEvent.dtend,
        });
      }

      continue;
    }

    if (!insideEvent) continue;

    if (line.startsWith("SUMMARY:")) {
      currentEvent.summary = unescapeIcsText(line.slice(8).trim());
    } else if (line.startsWith("DTSTART")) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      currentEvent.dtstart = normalizeIcsDate(value);
    } else if (line.startsWith("DTEND")) {
      const value = line.slice(line.indexOf(":") + 1).trim();
      currentEvent.dtend = normalizeIcsDate(value);
    }
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return events.filter((event) => {
    const date = new Date(event.dtstart);
    return !Number.isNaN(date.getTime()) && date >= oneYearAgo;
  });
}


function combineLocalDateAndTime(
  date: Date,
  time: string,
): Date | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);

  return Number.isNaN(result.getTime()) ? null : result;
}


export default function CalendarPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showIcsDialog, setShowIcsDialog] = useState(false);

  const [addType, setAddType] = useState<EventType>("appointment");
  const [dialogEvent, setDialogEvent] = useState<CalendarEvent | null>(null);

  const [newApptName, setNewApptName] = useState("");
  const [newApptDate, setNewApptDate] = useState<Date | undefined>();
  const [newApptTime, setNewApptTime] = useState("09:00");

  const [newMedName, setNewMedName] = useState("");
  const [newMedDate, setNewMedDate] = useState<Date | undefined>();
  const [newMedTime, setNewMedTime] = useState("09:00");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedDosageUnit, setNewMedDosageUnit] = useState("mg");
  const [newMedRecurrence, setNewMedRecurrence] = useState("Daily");

  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editTime, setEditTime] = useState("09:00");
  const [editMedDosage, setEditMedDosage] = useState("");
  const [editMedDosageUnit, setEditMedDosageUnit] = useState("mg");
  const [editMedRecurrence, setEditMedRecurrence] = useState("Daily");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    new Set(),
  );
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  const broadcastChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAllData = useCallback(async (uid: string) => {
    setIsLoading(true);

    try {
      const [medications, appointments] = await Promise.all([
        getMedicationRemindersByUser(uid),
        getAppointmentRemindersByUser(uid),
      ]);

      const medicationEvents = medications.flatMap((medication) =>
        expandMedication(medication),
      );

      const appointmentEvents = appointments.map(makeAppointmentEvent);

      setEvents([...medicationEvents, ...appointmentEvents]);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
      toast.error("Unable to load your calendar.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendBroadcast = useCallback(
    (eventName: string, message: string) => {
      broadcastChannelRef.current?.send({
        type: "broadcast",
        event: eventName,
        payload: { message },
      });
    },
    [],
  );

  // Load the signed-in user, fetch calendar data, and subscribe to changes.
  useEffect(() => {
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    async function initializeCalendar() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (error || !user) {
          router.push("/auth/login");
          setIsLoading(false);
          return;
        }

        setUserId(user.id);
        await fetchAllData(user.id);

        if (cancelled) return;

        const medicationChannel = supabase
          .channel(`calendar-medications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "medication_reminders",
              filter: `user_profile_id=eq.${user.id}`,
            },
            () => {
              void fetchAllData(user.id);
            },
          )
          .subscribe();

        const appointmentChannel = supabase
          .channel(`calendar-appointments-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "appointment_reminders",
              filter: `user_profile_id=eq.${user.id}`,
            },
            () => {
              void fetchAllData(user.id);
            },
          )
          .subscribe();

        channels.push(medicationChannel, appointmentChannel);
      } catch (error) {
        console.error("Error initializing calendar:", error);
        if (!cancelled) {
          setIsLoading(false);
          toast.error("Unable to load your calendar.");
        }
      }
    }

    void initializeCalendar();

    return () => {
      cancelled = true;
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [fetchAllData, router]);

  // Subscribe to messages broadcast from the user's other sessions.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToUserChannel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      channel = supabase.channel(`user-channel-${user.id}`, {
        config: { broadcast: { self: false } },
      });

      broadcastChannelRef.current = channel;

      channel
        .on("broadcast", { event: "*" }, (payload) => {
          const message = payload?.payload?.message;

          if (typeof message === "string" && message.length > 0) {
            toast.success(
              `Update from another device: ${message.replace(/\./g, "")}`,
            );
          }
        })
        .subscribe();
    }

    void subscribeToUserChannel();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }

      broadcastChannelRef.current = null;
    };
  }, []);

  function openAddDialog(type: EventType) {
    setAddType(type);

    if (type === "appointment") {
      setNewApptDate(new Date());
      setNewApptTime(format(new Date(), "HH:mm"));
    } else {
      setNewMedDate(new Date());
      setNewMedTime(format(new Date(), "HH:mm"));
    }

    setShowAddDialog(true);
  }

  function handleSelectSlot(slotInfo: { start: Date; end: Date }) {
    setNewApptDate(slotInfo.start);
    setNewMedDate(slotInfo.start);
    setNewApptTime(format(slotInfo.start, "HH:mm"));
    setNewMedTime(format(slotInfo.start, "HH:mm"));
    setAddType("appointment");
    setShowAddDialog(true);
  }

  async function handleAddAppointment() {
    if (!userId || !newApptName.trim() || !newApptDate) {
      toast.error("Please enter an appointment name and date.");
      return;
    }

    const localDate = combineLocalDateAndTime(
      newApptDate,
      newApptTime,
    );

    if (!localDate) {
      toast.error("Please select a valid appointment date and time.");
      return;
    }

    setIsSaving(true);

    try {
      const created = await createAppointmentReminder({
        user_profile_id: userId,
        appointment_name: newApptName.trim(),
        date: localDate.toISOString(),
      });

      setEvents((previous) => [...previous, makeAppointmentEvent(created)]);

      sendBroadcast(
        "appt-add",
        `New appointment reminder "${created.appointment_name}" added.`,
      );

      toast.success("Appointment added successfully.");
      setShowAddDialog(false);
      setNewApptName("");
      setNewApptDate(undefined);
      setNewApptTime("09:00");
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Unable to create appointment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMedication() {
    if (!userId || !newMedName.trim() || !newMedDate) {
      toast.error("Please enter a medication name and date.");
      return;
    }

    const localDate = combineLocalDateAndTime(
      newMedDate,
      newMedTime,
    );

    if (!localDate) {
      toast.error("Please select a valid medication date and time.");
      return;
    }

    setIsSaving(true);

    try {
      const dosage = newMedDosage.trim()
        ? `${newMedDosage.trim()} ${newMedDosageUnit}`
        : "";

      const created = await createMedicationReminder({
        user_profile_id: userId,
        medication_name: newMedName.trim(),
        dosage,
        reminder_time: localDate.toISOString(),
        recurrence: newMedRecurrence,
        calendar_sync_token: null,
      });

      setEvents((previous) => [
        ...previous,
        ...expandMedication(created),
      ]);

      sendBroadcast(
        "med-add",
        `New medication reminder "${created.medication_name}" added.`,
      );

      toast.success("Medication added successfully.");
      setShowAddDialog(false);
      setNewMedName("");
      setNewMedDate(undefined);
      setNewMedTime("09:00");
      setNewMedDosage("");
      setNewMedDosageUnit("mg");
      setNewMedRecurrence("Daily");
    } catch (error) {
      console.error("Error creating medication reminder:", error);
      toast.error("Unable to create medication reminder.");
    } finally {
      setIsSaving(false);
    }
  }

  function openEventDialog(event: CalendarEvent) {
    if (selectMode) {
      setSelectedEventIds((previous) => {
        const next = new Set(previous);

        if (next.has(event.id)) {
          next.delete(event.id);
        } else {
          next.add(event.id);
        }

        return next;
      });

      return;
    }

    setDialogEvent(event);
    setEditTitle(event.title);
    setEditDate(event.start);
    setEditTime(format(event.start, "HH:mm"));

    if (event.type === "medication") {
      const dosageParts = (event.dosage ?? "").trim().split(/\s+/);

      setEditMedDosage(dosageParts[0] ?? "");
      setEditMedDosageUnit(dosageParts[1] ?? "mg");
      setEditMedRecurrence(event.recurrence || "Daily");
    }

    setShowEventDialog(true);
  }

  async function handleSaveEventEdits() {
    if (!dialogEvent || !editDate || !editTitle.trim()) {
      toast.error("Please complete the required fields.");
      return;
    }

    const localDate = combineLocalDateAndTime(editDate, editTime);

    if (!localDate) {
      toast.error("Please select a valid date and time.");
      return;
    }

    setIsSaving(true);

    try {
      const isoString = localDate.toISOString();

      if (dialogEvent.type === "appointment") {
        const appointmentId = dialogEvent.id.slice(5);

        const updated = await updateAppointmentReminder(appointmentId, {
          appointment_name: editTitle.trim(),
          date: isoString,
        });

        const updatedEvent = makeAppointmentEvent(updated);

        setEvents((previous) =>
          previous.map((event) =>
            event.id === dialogEvent.id ? updatedEvent : event,
          ),
        );

        sendBroadcast(
          "appt-update",
          `Appointment "${editTitle.trim()}" updated.`,
        );

        toast.success("Appointment updated successfully.");
      } else {
        const medicationId = getMedicationId(dialogEvent.id);
        const dosage = editMedDosage.trim()
          ? `${editMedDosage.trim()} ${editMedDosageUnit}`
          : "";

        const updated = await updateMedicationReminder(medicationId, {
          medication_name: editTitle.trim(),
          dosage,
          reminder_time: isoString,
          recurrence: editMedRecurrence,
        });

        const replacementEvents = expandMedication(updated);

        setEvents((previous) => [
          ...previous.filter(
            (event) =>
              event.type !== "medication" ||
              getMedicationId(event.id) !== medicationId,
          ),
          ...replacementEvents,
        ]);

        sendBroadcast(
          "med-update",
          `Medication "${editTitle.trim()}" updated.`,
        );

        toast.success("Medication reminder updated successfully.");
      }

      setShowEventDialog(false);
      setDialogEvent(null);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      toast.error("Unable to update this event.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDeleteEvent() {
    if (!dialogEvent) return;

    setDeleteTargetIds([dialogEvent.id]);
    setShowDeleteDialog(true);
  }

  function requestDeleteSelected() {
    if (selectedEventIds.size === 0) return;

    setDeleteTargetIds(Array.from(selectedEventIds));
    setShowDeleteDialog(true);
  }

  async function handleDeleteEvents() {
    if (deleteTargetIds.length === 0) return;

    const appointmentIds = new Set<string>();
    const medicationIds = new Set<string>();

    deleteTargetIds.forEach((eventId) => {
      if (eventId.startsWith("appt-")) {
        appointmentIds.add(eventId.slice(5));
      } else if (eventId.startsWith("med-")) {
        medicationIds.add(getMedicationId(eventId));
      }
    });

    setIsSaving(true);

    try {
      await Promise.all([
        ...Array.from(appointmentIds).map((id) =>
          deleteAppointmentReminder(id),
        ),
        ...Array.from(medicationIds).map((id) =>
          deleteMedicationReminder(id),
        ),
      ]);

      setEvents((previous) =>
        previous.filter((event) => {
          if (event.type === "appointment") {
            return !appointmentIds.has(event.id.slice(5));
          }

          return !medicationIds.has(getMedicationId(event.id));
        }),
      );

      appointmentIds.forEach(() => {
        sendBroadcast("appt-delete", "An appointment reminder was deleted.");
      });

      medicationIds.forEach(() => {
        sendBroadcast("med-delete", "A medication reminder was deleted.");
      });

      toast.success(
        `${appointmentIds.size + medicationIds.size} reminder${
          appointmentIds.size + medicationIds.size === 1 ? "" : "s"
        } deleted.`,
      );

      setSelectedEventIds(new Set());
      setSelectMode(false);
      setShowDeleteDialog(false);
      setShowEventDialog(false);
      setDialogEvent(null);
      setDeleteTargetIds([]);
    } catch (error) {
      console.error("Error deleting calendar events:", error);
      toast.error("Unable to delete the selected reminders.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportCalendar() {
    const icsString = generateIcs(events);
    const blob = new Blob([icsString], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "symptomsync-calendar.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Calendar export downloaded.");
  }

  async function handleImportCalendar(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) return;

    if (!file.name.toLowerCase().endsWith(".ics")) {
      toast.error("Please select an .ics calendar file.");
      event.target.value = "";
      return;
    }

    setIsSaving(true);

    try {
      const text = await file.text();
      const importedEvents = parseIcs(text);

      if (importedEvents.length === 0) {
        toast.error("No supported calendar events were found in this file.");
        return;
      }

      let importedCount = 0;

      for (const imported of importedEvents) {
        const startDate = new Date(imported.dtstart);

        if (Number.isNaN(startDate.getTime())) continue;

        const medicationMatch =
          /^(?:Med|Medication):\s*/i.exec(imported.summary);

        if (medicationMatch) {
          const medicationName = imported.summary
            .replace(/^(?:Med|Medication):\s*/i, "")
            .trim();

          if (!medicationName) continue;

          await createMedicationReminder({
            user_profile_id: userId,
            medication_name: medicationName,
            dosage: null,
            reminder_time: startDate.toISOString(),
            recurrence: "As Needed",
            calendar_sync_token: null,
          });
        } else {
          await createAppointmentReminder({
            user_profile_id: userId,
            appointment_name: imported.summary.trim(),
            date: startDate.toISOString(),
          });
        }

        importedCount += 1;
      }

      await fetchAllData(userId);

      if (importedCount > 0) {
        toast.success(
          `${importedCount} calendar event${
            importedCount === 1 ? "" : "s"
          } imported.`,
        );
      } else {
        toast.error("No valid events could be imported.");
      }
    } catch (error) {
      console.error("Error importing calendar:", error);
      toast.error("Unable to import this calendar file.");
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  }

  function eventPropGetter(event: CalendarEvent) {
    const isSelected = selectedEventIds.has(event.id);
    const isMedication = event.type === "medication";

    const style: CSSProperties = {
      backgroundColor: isMedication ? "#e8eef2" : "#e9ebf2",
      color: isMedication ? "#405f73" : "#555d79",
      border: isSelected
        ? "2px solid #405f73"
        : "1px solid transparent",
      borderRadius: "7px",
      padding: "3px 6px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
    };

    return { style };
  }

  const medicationCount = events.filter(
    (event) => event.type === "medication",
  ).length;

  const appointmentCount = events.filter(
    (event) => event.type === "appointment",
  ).length;

  const calendarMessages = {
    today: "Today",
    previous: "Back",
    next: "Next",
    month: "Month",
    week: "Week",
    day: "Day",
    agenda: "Agenda",
    date: "Date",
    time: "Time",
    event: "Event",
    noEventsInRange: "No reminders scheduled in this range.",
    showMore: (total: number) => `+${total} more`,
  };

  return (
    <>
      <Head>
        <title>SymptomSync | Calendar</title>
        <meta
          name="description"
          content="Manage your appointments and medication reminders in one calendar."
        />
      </Head>

      <div className="min-h-screen bg-[#f7f8f8] text-[#27333b]">
        <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
                    <CalendarDays size={19} />
                  </div>
                  <span className="text-sm font-semibold tracking-wide text-[#587587]">
                    YOUR HEALTH RECORDS
                  </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-[#27333b] sm:text-4xl">
                  Your calendar
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#69747b] sm:text-base">
                  Keep your appointments and medication reminders organized
                  in one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-[#e4e8e9] bg-white px-3.5 py-2 text-sm text-[#587587]">
                  <Pill size={15} />
                  <span className="font-medium">
                    {medicationCount} medications
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-[#e4e8e9] bg-white px-3.5 py-2 text-sm text-[#626b83]">
                  <CalendarDays size={15} />
                  <span className="font-medium">
                    {appointmentCount} appointments
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar actions */}
          <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#e4e8e9] bg-white p-4 shadow-[0_2px_10px_rgba(39,51,59,0.03)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-base font-semibold text-[#27333b]">
                Calendar overview
              </h2>
              <p className="mt-1 text-sm text-[#7a858b]">
                Select a date to add a reminder, or select an event to edit it.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => openAddDialog("appointment")}
                className="cursor-pointer rounded-full bg-[#405f73] px-4 text-white"
              >
                <Plus size={16} className="mr-1.5" />
                Appointment
              </Button>

              <Button
                onClick={() => openAddDialog("medication")}
                variant="outline"
                className="cursor-pointer rounded-full border-[#dce4e8] text-[#405f73]"
              >
                <Pill size={16} className="mr-1.5" />
                Medication
              </Button>

              <Button
                onClick={() => setShowIcsDialog(true)}
                variant="outline"
                className="cursor-pointer rounded-full border-[#e4e8e9] text-[#69747b]"
              >
                <Download size={16} className="mr-1.5" />
                Import / Export
              </Button>
            </div>
          </section>

          {/* Calendar legend and selection controls */}
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs font-medium text-[#69747b]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#718b9b]" />
                Medication
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#9298b0]" />
                Appointment
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectMode && selectedEventIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={requestDeleteSelected}
                  className="cursor-pointer rounded-full"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete selected ({selectedEventIds.size})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectMode((previous) => !previous);
                  setSelectedEventIds(new Set());
                }}
                className="cursor-pointer rounded-full border-[#e4e8e9] bg-white text-[#69747b]"
              >
                {selectMode ? (
                  <>
                    <X size={14} className="mr-1.5" />
                    Exit selection
                  </>
                ) : (
                  <>
                    <Check size={14} className="mr-1.5" />
                    Select events
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Calendar */}
          <section className="relative min-h-[620px] rounded-2xl border border-[#e4e8e9] bg-white p-3 shadow-[0_2px_10px_rgba(39,51,59,0.03)] sm:p-5">
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/75">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#587587]" />
                  <p className="text-sm text-[#69747b]">
                    Loading your calendar...
                  </p>
                </div>
              </div>
            )}

            <div className="symptomsync-calendar">
              <Calendar<CalendarEvent>
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                views={["month", "week", "day", "agenda"]}
                defaultView="month"
                selectable
                onSelectEvent={openEventDialog}
                onSelectSlot={handleSelectSlot}
                eventPropGetter={eventPropGetter}
                messages={calendarMessages}
                popup
                style={{ minHeight: "590px" }}
              />
            </div>
          </section>

          <p className="mt-3 px-1 text-xs leading-5 text-[#899399]">
            Medication events are displayed according to their recurrence
            settings for the next 90 days. Select a medication event to edit or
            delete its reminder series.
          </p>
        </main>
      </div>

      {/* Add reminder dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-[#e4e8e9] bg-white p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              {addType === "appointment" ? (
                <CalendarDays size={19} />
              ) : (
                <Pill size={19} />
              )}
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Add {addType === "appointment" ? "appointment" : "medication"}
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              {addType === "appointment"
                ? "Add an upcoming appointment to your calendar."
                : "Add a medication and choose when its reminder should appear."}
            </DialogDescription>
          </DialogHeader>

          {addType === "appointment" ? (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Appointment name
                </Label>
                <Input
                  value={newApptName}
                  onChange={(event) => setNewApptName(event.target.value)}
                  placeholder="e.g. Annual check-up"
                  className="h-11 rounded-xl border-[#e4e8e9] focus-visible:ring-[#718b9b]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Date
                </Label>
                <DatePicker
                  value={newApptDate}
                  onChange={setNewApptDate}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Time
                </Label>
                <CustomTimePicker
                  value={newApptTime}
                  onChange={setNewApptTime}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Medication name
                </Label>
                <Input
                  value={newMedName}
                  onChange={(event) => setNewMedName(event.target.value)}
                  placeholder="e.g. Ibuprofen"
                  className="h-11 rounded-xl border-[#e4e8e9] focus-visible:ring-[#718b9b]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#40505a]">
                    Date
                  </Label>
                  <DatePicker
                    value={newMedDate}
                    onChange={setNewMedDate}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#40505a]">
                    Time
                  </Label>
                  <CustomTimePicker
                    value={newMedTime}
                    onChange={setNewMedTime}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Dosage
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newMedDosage}
                    onChange={(event) =>
                      setNewMedDosage(event.target.value)
                    }
                    placeholder="e.g. 200"
                    className="h-11 rounded-xl border-[#e4e8e9] focus-visible:ring-[#718b9b]"
                  />

                  <Select
                    value={newMedDosageUnit}
                    onValueChange={setNewMedDosageUnit}
                  >
                    <SelectTrigger className="h-11 w-28 rounded-xl border-[#e4e8e9]">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mg">mg</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  Recurrence
                </Label>
                <Select
                  value={newMedRecurrence}
                  onValueChange={setNewMedRecurrence}
                >
                  <SelectTrigger className="h-11 rounded-xl border-[#e4e8e9]">
                    <SelectValue placeholder="Choose a schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isSaving}
              className="cursor-pointer rounded-full border-[#e4e8e9]"
            >
              Cancel
            </Button>

            <Button
              onClick={
                addType === "appointment"
                  ? handleAddAppointment
                  : handleAddMedication
              }
              disabled={
                isSaving ||
                (addType === "appointment"
                  ? !newApptName.trim() || !newApptDate
                  : !newMedName.trim() || !newMedDate)
              }
              className="cursor-pointer rounded-full bg-[#405f73] text-white"
            >
              {isSaving && (
                <Loader2 size={15} className="mr-2 animate-spin" />
              )}
              Save reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit event dialog */}
      <Dialog
        open={showEventDialog}
        onOpenChange={(open) => {
          if (!isSaving) setShowEventDialog(open);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-[#e4e8e9] bg-white p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              {dialogEvent?.type === "medication" ? (
                <Pill size={19} />
              ) : (
                <CalendarDays size={19} />
              )}
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Edit {dialogEvent?.type === "medication" ? "medication" : "appointment"}
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              Update the reminder details or delete this reminder.
              {dialogEvent?.type === "medication" &&
                " Changes apply to the entire medication series."}
            </DialogDescription>
          </DialogHeader>

          {dialogEvent && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#40505a]">
                  {dialogEvent.type === "medication"
                    ? "Medication name"
                    : "Appointment name"}
                </Label>
                <Input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="h-11 rounded-xl border-[#e4e8e9] focus-visible:ring-[#718b9b]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#40505a]">
                    Date
                  </Label>
                  <DatePicker
                    value={editDate}
                    onChange={setEditDate}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#40505a]">
                    Time
                  </Label>
                  <CustomTimePicker
                    value={editTime}
                    onChange={setEditTime}
                  />
                </div>
              </div>

              {dialogEvent.type === "medication" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#40505a]">
                      Dosage
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={editMedDosage}
                        onChange={(event) =>
                          setEditMedDosage(event.target.value)
                        }
                        placeholder="e.g. 200"
                        className="h-11 rounded-xl border-[#e4e8e9] focus-visible:ring-[#718b9b]"
                      />

                      <Select
                        value={editMedDosageUnit}
                        onValueChange={setEditMedDosageUnit}
                      >
                        <SelectTrigger className="h-11 w-28 rounded-xl border-[#e4e8e9]">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mg">mg</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[#40505a]">
                      Recurrence
                    </Label>
                    <Select
                      value={editMedRecurrence}
                      onValueChange={setEditMedRecurrence}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-[#e4e8e9]">
                        <SelectValue placeholder="Choose a schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-2">
            <Button
              variant="outline"
              onClick={requestDeleteEvent}
              disabled={isSaving}
              className="cursor-pointer rounded-full border-[#eadada] text-[#a34d4d] hover:bg-[#fbf3f3] hover:text-[#923d3d]"
            >
              <Trash2 size={15} className="mr-1.5" />
              Delete
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEventDialog(false)}
                disabled={isSaving}
                className="cursor-pointer rounded-full border-[#e4e8e9]"
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveEventEdits}
                disabled={isSaving || !editTitle.trim() || !editDate}
                className="cursor-pointer rounded-full bg-[#405f73] text-white hover:bg-[#324e60]"
              >
                {isSaving ? (
                  <Loader2 size={15} className="mr-2 animate-spin" />
                ) : (
                  <Pencil size={14} className="mr-2" />
                )}
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!isSaving) setShowDeleteDialog(open);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border-[#e4e8e9] bg-white p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8eeee] text-[#a34d4d]">
              <Trash2 size={18} />
            </div>

            <DialogTitle className="text-lg font-semibold text-[#27333b]">
              Delete reminder{deleteTargetIds.length === 1 ? "" : "s"}?
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              {deleteTargetIds.length === 1
                ? "This will permanently delete this reminder."
                : `This will permanently delete ${deleteTargetIds.length} selected calendar events. Medication events are deleted as complete reminder series.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSaving}
              className="cursor-pointer rounded-full border-[#e4e8e9]"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeleteEvents}
              disabled={isSaving}
              className="cursor-pointer rounded-full"
            >
              {isSaving && (
                <Loader2 size={15} className="mr-2 animate-spin" />
              )}
              Delete reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ICS import/export dialog */}
      <Dialog open={showIcsDialog} onOpenChange={setShowIcsDialog}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-[#e4e8e9] bg-white p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6edf2] text-[#405f73]">
              <Download size={19} />
            </div>

            <DialogTitle className="text-xl font-semibold text-[#27333b]">
              Calendar import & export
            </DialogTitle>

            <DialogDescription className="text-sm leading-6 text-[#69747b]">
              Transfer your SymptomSync reminders to or from another calendar
              application using an ICS file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="rounded-xl border border-[#e4e8e9] bg-[#fbfcfc] p-4">
              <div className="mb-2 flex items-center gap-2 text-[#405f73]">
                <Download size={17} />
                <h3 className="font-semibold text-[#27333b]">
                  Export your calendar
                </h3>
              </div>

              <p className="mb-4 text-sm leading-6 text-[#69747b]">
                Download your current calendar events as an ICS file. You can
                import it into Google Calendar, Outlook, or Apple Calendar.
              </p>

              <Button
                onClick={handleExportCalendar}
                className="cursor-pointer rounded-full bg-[#405f73] text-white hover:bg-[#324e60]"
              >
                <Download size={15} className="mr-2" />
                Download ICS file
              </Button>
            </div>

            <div className="rounded-xl border border-[#e4e8e9] bg-[#fbfcfc] p-4">
              <div className="mb-2 flex items-center gap-2 text-[#405f73]">
                <FileUp size={17} />
                <h3 className="font-semibold text-[#27333b]">
                  Import a calendar
                </h3>
              </div>

              <p className="mb-4 text-sm leading-6 text-[#69747b]">
                Select an ICS file exported from another calendar. Events
                dated within the past year are imported. Events labeled
                &quot;Med:&quot; or &quot;Medication:&quot; are treated as
                medication reminders; other events are imported as
                appointments.
              </p>

              <Input
                type="file"
                accept=".ics,text/calendar"
                onChange={handleImportCalendar}
                disabled={isSaving}
                className="cursor-pointer rounded-xl border-[#e4e8e9] bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6edf2] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#405f73]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowIcsDialog(false)}
              className="cursor-pointer rounded-full border-[#e4e8e9]"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .symptomsync-calendar {
          min-width: 0;
          color: #27333b;
          font-family: inherit;
        }

        .symptomsync-calendar .rbc-calendar {
          min-height: 590px;
        }

        .symptomsync-calendar .rbc-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        }

        .symptomsync-calendar .rbc-toolbar-label {
          color: #27333b;
          font-size: 17px;
          font-weight: 650;
          text-align: center;
        }

        .symptomsync-calendar .rbc-toolbar button {
          border: 1px solid #e4e8e9;
          border-radius: 999px;
          background: #fff;
          color: #587587;
          font-size: 12px;
          font-weight: 600;
          padding: 7px 12px;
          transition: background 150ms ease, border-color 150ms ease;
        }

        .symptomsync-calendar .rbc-toolbar button:hover {
          border-color: #cbd8df;
          background: #f1f5f7;
          color: #405f73;
        }

        .symptomsync-calendar .rbc-toolbar button.rbc-active,
        .symptomsync-calendar .rbc-toolbar button.rbc-active:hover {
          border-color: #405f73;
          background: #405f73;
          color: #fff;
          box-shadow: none;
        }

        .symptomsync-calendar .rbc-month-view,
        .symptomsync-calendar .rbc-time-view,
        .symptomsync-calendar .rbc-agenda-view {
          overflow: hidden;
          border: 1px solid #e8ecee;
          border-radius: 12px;
        }

        .symptomsync-calendar .rbc-header {
          border-bottom: 1px solid #e8ecee;
          background: #fafbfb;
          color: #69747b;
          font-size: 11px;
          font-weight: 650;
          padding: 11px 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .symptomsync-calendar .rbc-month-row {
          border-top: 1px solid #edf0f1;
        }

        .symptomsync-calendar .rbc-day-bg {
          border-left: 1px solid #edf0f1;
        }

        .symptomsync-calendar .rbc-off-range-bg {
          background: #fafbfb;
        }

        .symptomsync-calendar .rbc-today {
          background: #f1f5f7;
        }

        .symptomsync-calendar .rbc-date-cell {
          color: #69747b;
          font-size: 12px;
          padding: 6px 7px;
        }

        .symptomsync-calendar .rbc-now .rbc-button-link {
          color: #405f73;
          font-weight: 750;
        }

        .symptomsync-calendar .rbc-show-more {
          color: #587587;
          font-size: 11px;
          font-weight: 650;
        }

        .symptomsync-calendar .rbc-event {
          border-radius: 7px;
          padding: 3px 6px;
        }

        .symptomsync-calendar .rbc-event:focus {
          outline: 2px solid #718b9b;
          outline-offset: 1px;
        }

        .symptomsync-calendar .rbc-time-header-content,
        .symptomsync-calendar .rbc-time-content,
        .symptomsync-calendar .rbc-timeslot-group {
          border-color: #edf0f1;
        }

        .symptomsync-calendar .rbc-time-gutter,
        .symptomsync-calendar .rbc-label {
          color: #899399;
          font-size: 11px;
        }

        .symptomsync-calendar .rbc-current-time-indicator {
          background-color: #718b9b;
        }

        .symptomsync-calendar .rbc-agenda-table {
          border: 0;
        }

        .symptomsync-calendar .rbc-agenda-date-cell,
        .symptomsync-calendar .rbc-agenda-time-cell {
          color: #69747b;
          font-size: 12px;
        }

        .symptomsync-calendar .rbc-agenda-event-cell {
          color: #27333b;
          font-size: 13px;
        }

        @media (max-width: 640px) {
          .symptomsync-calendar .rbc-toolbar {
            justify-content: center;
          }

          .symptomsync-calendar .rbc-toolbar-label {
            order: -1;
            width: 100%;
            padding-bottom: 4px;
          }

          .symptomsync-calendar .rbc-toolbar .rbc-btn-group {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
          }

          .symptomsync-calendar .rbc-toolbar button {
            padding: 6px 9px;
            font-size: 11px;
          }

          .symptomsync-calendar .rbc-date-cell {
            padding: 4px 3px;
            font-size: 11px;
          }

          .symptomsync-calendar .rbc-event {
            padding: 2px 3px;
            font-size: 10px;
          }
        }
      `}</style>
    </>
  );
}