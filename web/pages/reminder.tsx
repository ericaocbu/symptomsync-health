import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  Loader2,
  Pencil,
  Pill,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { getPaginatedMedicationRemindersByUser } from "@/lib/medications";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { CustomTimePicker } from "@/components/ui/time-picker";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Reminder {
  id: string;
  medication_name: string;
  dosage: string;
  reminder_time: string;
  recurrence: string;
  user_profile_id: string;
}

const ITEMS_PER_PAGE = 50;

export default function MedicationReminders() {
  const router = useRouter();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingMed, setEditingMed] = useState<Reminder | null>(null);
  const [editMedName, setEditMedName] = useState("");
  const [editMedDosage, setEditMedDosage] = useState("");
  const [editMedDosageUnit, setEditMedDosageUnit] = useState("mg");
  const [editMedDate, setEditMedDate] = useState<Date | undefined>();
  const [editMedTimePicker, setEditMedTimePicker] = useState("00:00");
  const [editMedRecurrence, setEditMedRecurrence] = useState("Daily");

  const [medPage, setMedPage] = useState(1);
  const [totalMeds, setTotalMeds] = useState(0);

  const broadcastChannelRef = useRef<any>(null);

  const totalPages = Math.ceil(totalMeds / ITEMS_PER_PAGE);

  const sendBroadcast = (eventName: string, message: string) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: "broadcast",
        event: eventName,
        payload: { message },
      });
    }
  };

  const fetchReminders = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login");
        return;
      }

      const { data, count } = await getPaginatedMedicationRemindersByUser(
        user.id,
        medPage,
        ITEMS_PER_PAGE,
      );

      const uiReminders: Reminder[] = data.map((reminder) => ({
        ...reminder,
        dosage: reminder.dosage ?? "",
        recurrence: reminder.recurrence ?? "",
      }));

      setReminders(uiReminders);
      setTotalMeds(count);
    } catch (error) {
      console.error("Error fetching medication reminders:", error);
      toast.error("Failed to load medication reminders.");
    } finally {
      setLoading(false);
    }
  }, [medPage, router]);

  // Fetch reminders whenever the current page changes.
  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Subscribe to notifications from other devices or tabs.
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
        .on("broadcast", { event: "*" }, (payload: any) => {
          const message = payload?.payload?.message;

          if (message) {
            toast.success(
              `Notification: ${message.replace(/\./g, "")} from another device or tab.`,
            );
          }
        })
        .subscribe((status) => {
          console.log("User-specific channel status:", status);
        });
    }

    subscribeToUserChannel();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(channel);
      }

      broadcastChannelRef.current = null;
    };
  }, []);

  // Listen for medication reminder changes in Supabase.
  useEffect(() => {
    let cancelled = false;
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToMedicationChanges() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      subscription = supabase
        .channel(`medication-changes-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "medication_reminders",
            filter: `user_profile_id=eq.${user.id}`,
          },
          () => {
            fetchReminders();
          },
        )
        .subscribe();
    }

    subscribeToMedicationChanges();

    return () => {
      cancelled = true;

      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [fetchReminders]);

  function openEditMedDialog(medication: Reminder) {
    setEditingMed(medication);
    setEditMedName(medication.medication_name);

    if (medication.dosage) {
      const parts = medication.dosage.split(" ");
      setEditMedDosage(parts[0] || "");
      setEditMedDosageUnit(parts[1] || "mg");
    } else {
      setEditMedDosage("");
      setEditMedDosageUnit("mg");
    }

    const medicationDate = new Date(medication.reminder_time);

    setEditMedDate(medicationDate);
    setEditMedTimePicker(medicationDate.toTimeString().slice(0, 5));
    setEditMedRecurrence(medication.recurrence || "Daily");
  }

  function closeEditDialog() {
    if (saving) return;

    setEditingMed(null);
    setEditMedName("");
    setEditMedDosage("");
    setEditMedDosageUnit("mg");
    setEditMedDate(undefined);
    setEditMedTimePicker("00:00");
    setEditMedRecurrence("Daily");
  }

  async function handleUpdateMed() {
    if (!editingMed || !editMedDate) return;

    if (!editMedName.trim()) {
      toast.error("Please enter a medication name.");
      return;
    }

    if (!editMedTimePicker) {
      toast.error("Please select a reminder time.");
      return;
    }

    const dateString = format(editMedDate, "yyyy-MM-dd");
    const combinedDateTime = new Date(`${dateString}T${editMedTimePicker}`);

    if (Number.isNaN(combinedDateTime.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("medication_reminders")
        .update({
          medication_name: editMedName.trim(),
          dosage: editMedDosage.trim()
            ? `${editMedDosage.trim()} ${editMedDosageUnit}`
            : "",
          reminder_time: combinedDateTime.toISOString(),
          recurrence: editMedRecurrence,
        })
        .eq("id", editingMed.id);

      if (error) {
        console.error("Failed to update medication reminder:", error);
        toast.error("Failed to update medication reminder.");
        return;
      }

      await fetchReminders();

      sendBroadcast(
        "med-update",
        `Medication reminder "${editMedName.trim()}" updated successfully.`,
      );

      toast.success("Medication reminder updated successfully.");
      closeEditDialog();
    } catch (error) {
      console.error("Error updating medication reminder:", error);
      toast.error("Something went wrong while updating the reminder.");
    } finally {
      setSaving(false);
    }
  }

  function handleBellClick(reminder: Reminder) {
    const takeTime = format(new Date(reminder.reminder_time), "PPP, h:mm a");

    toast(
      `Reminder: Do not forget to take ${reminder.medication_name} on ${takeTime}!`,
    );
  }

  const startIndex = totalMeds > 0 ? (medPage - 1) * ITEMS_PER_PAGE + 1 : 0;

  const endIndex = Math.min(medPage * ITEMS_PER_PAGE, totalMeds);

  return (
    <>
      <Head>
        <title>SymptomSync | Medications</title>
        <meta
          name="description"
          content="View and manage your medication reminders."
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
                    <Pill size={19} />
                  </div>
                  <span className="text-sm font-semibold tracking-wide text-[#587587]">
                    YOUR HEALTH RECORDS
                  </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-[#27333b] sm:text-4xl">
                  Your medications
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#69747b] sm:text-base">
                  Keep track of your medications and their reminder schedules in
                  one place.
                </p>
              </div>

              {!loading && (
                <div className="flex items-center gap-2 self-start rounded-full border border-[#e4e8e9] bg-white px-4 py-2 text-sm text-[#587587] sm:self-auto">
                  <Pill size={16} />
                  <span className="font-medium">
                    {totalMeds} {totalMeds === 1 ? "medication" : "medications"}
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Medication list */}
          <section className="rounded-2xl border border-[#e4e8e9] bg-white p-5 shadow-[0_2px_10px_rgba(39,51,59,0.03)] sm:p-7">
            <div className="mb-6 flex flex-col gap-2 border-b border-[#edf0f1] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#27333b]">
                  Your medication schedule
                </h2>
                <p className="mt-1 text-sm text-[#7a858b]">
                  Review your doses and update reminder details.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start rounded-lg bg-[#f2f5f6] px-3 py-2 text-xs font-medium text-[#587587]">
                <CalendarDays size={15} />
                Reminder overview
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#718b9b]" />
                <p className="text-sm text-[#7a858b]">
                  Loading your medications...
                </p>
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-10 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf0f3] text-[#587587]">
                  <ClipboardList size={28} strokeWidth={1.6} />
                </div>

                <h3 className="text-lg font-semibold text-[#27333b]">
                  No medications yet
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-[#7a858b]">
                  Your medication reminders will appear here once they have been
                  added to your account.
                </p>

                <Button
                  variant="outline"
                  onClick={() => router.push("/home")}
                  className="mt-5 rounded-full border-[#dce4e8] text-[#587587]"
                >
                  Return to dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => {
                  const reminderDate = new Date(reminder.reminder_time);
                  const validDate = !Number.isNaN(reminderDate.getTime());

                  return (
                    <div
                      key={reminder.id}
                      className="group flex flex-col gap-4 rounded-xl border border-[#e8ecee] bg-white p-4 transition-all duration-200 hover:border-[#cbd8df] sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eaf0f3] text-[#587587]">
                          <Pill size={22} strokeWidth={1.7} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold text-[#27333b]">
                            {reminder.medication_name}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#69747b]">
                            <span className="flex items-center gap-1.5">
                              <Clock3 size={14} className="text-[#718b9b]" />
                              {validDate
                                ? format(reminderDate, "PPP, h:mm a")
                                : "Time not available"}
                            </span>

                            <span className="flex items-center gap-1.5">
                              <Pill size={14} className="text-[#718b9b]" />
                              {reminder.dosage || "Dosage not specified"}
                            </span>
                          </div>

                          <div className="mt-3">
                            <span className="inline-flex items-center rounded-full bg-[#f0f3f5] px-3 py-1 text-xs font-medium text-[#587587]">
                              {reminder.recurrence ||
                                "Recurrence not specified"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center justify-end gap-2 border-t border-[#edf0f1] pt-3 sm:border-0 sm:pt-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Show medication reminder"
                                onClick={() => handleBellClick(reminder)}
                                className="h-9 w-9 rounded-lg border-[#e4e8e9] text-[#587587] hover:border-[#cbd8df]"
                              >
                                <Bell size={16} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Show reminder</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Edit medication"
                                onClick={() => openEditMedDialog(reminder)}
                                className="h-9 w-9 rounded-lg border-[#e4e8e9] text-[#587587] hover:border-[#cbd8df]"
                              >
                                <Pencil size={16} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit medication</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-6 flex flex-col gap-4 border-t border-[#edf0f1] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#7a858b]">
                  Showing{" "}
                  <span className="font-medium text-[#27333b]">
                    {startIndex}–{endIndex}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-[#27333b]">
                    {totalMeds}
                  </span>{" "}
                  medications
                </p>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMedPage((page) => Math.max(page - 1, 1))}
                    disabled={medPage <= 1}
                    className="rounded-full border-[#e0e6e9] text-[#587587]"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>

                  <span className="whitespace-nowrap text-sm text-[#69747b]">
                    Page {medPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMedPage((page) => Math.min(page + 1, totalPages))
                    }
                    disabled={medPage >= totalPages}
                    className="rounded-full border-[#e0e6e9] text-[#587587]"
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Edit medication dialog */}
          <Dialog
            open={Boolean(editingMed)}
            onOpenChange={(open) => {
              if (!open) closeEditDialog();
            }}
          >
            <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-[#e4e8e9] bg-white p-5 sm:p-6">
              {" "}
              <DialogHeader>
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf0f3] text-[#587587]">
                  <Pill size={21} />
                </div>

                <DialogTitle className="text-xl font-semibold text-[#27333b]">
                  Edit medication
                </DialogTitle>

                <DialogDescription className="text-sm leading-6 text-[#7a858b]">
                  Update the medication details and reminder schedule below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-4">
                {/* Medication name */}
                <div className="space-y-2">
                  <Label
                    htmlFor="medication-name"
                    className="text-sm font-medium text-[#40505a]"
                  >
                    Medication name
                  </Label>

                  <Input
                    id="medication-name"
                    value={editMedName}
                    onChange={(event) => setEditMedName(event.target.value)}
                    placeholder="e.g. Medication name"
                    className="h-11 rounded-xl border-[#e1e6e8] bg-white focus-visible:ring-[#718b9b]"
                  />
                </div>

                {/* Dosage */}
                <div className="space-y-2">
                  <Label
                    htmlFor="medication-dosage"
                    className="text-sm font-medium text-[#40505a]"
                  >
                    Dosage
                  </Label>

                  <div className="flex gap-2">
                    <Input
                      id="medication-dosage"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={editMedDosage}
                      onChange={(event) => setEditMedDosage(event.target.value)}
                      placeholder="Amount"
                      className="h-11 flex-1 rounded-xl border-[#e1e6e8] focus-visible:ring-[#718b9b]"
                    />

                    <Select
                      value={editMedDosageUnit}
                      onValueChange={setEditMedDosageUnit}
                    >
                      <SelectTrigger className="h-11 w-28 rounded-xl border-[#e1e6e8] focus:ring-[#718b9b]">
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

                {/* Schedule */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-[#40505a]">
                    Reminder schedule
                  </Label>

                  <div className="space-y-2">
                    <Label
                      htmlFor="medication-date"
                      className="text-xs font-medium text-[#7a858b]"
                    >
                      Date
                    </Label>

                    <DatePicker
                      value={editMedDate}
                      onChange={setEditMedDate}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-[#7a858b]">
                      Time (24-hour format)
                    </Label>

                    <CustomTimePicker
                      value={editMedTimePicker}
                      onChange={setEditMedTimePicker}
                    />
                  </div>
                </div>

                {/* Recurrence */}
                <div className="space-y-2">
                  <Label
                    htmlFor="medication-recurrence"
                    className="text-sm font-medium text-[#40505a]"
                  >
                    Recurrence
                  </Label>

                  <Select
                    value={editMedRecurrence}
                    onValueChange={setEditMedRecurrence}
                  >
                    <SelectTrigger
                      id="medication-recurrence"
                      className="h-11 rounded-xl border-[#e1e6e8] focus:ring-[#718b9b]"
                    >
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Biweekly">Biweekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="As Needed">As Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={closeEditDialog}
                  disabled={saving}
                  className="rounded-full border-[#e0e6e9] text-[#69747b]"
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleUpdateMed}
                  disabled={
                    saving ||
                    !editMedName.trim() ||
                    !editMedDate ||
                    !editMedTimePicker
                  }
                  className="rounded-full bg-[#405f73] px-6 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </>
  );
}