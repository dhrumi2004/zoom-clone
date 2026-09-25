"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, FieldError, Label, RadioGroup, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserSettings } from "@/hooks/useUserSettings";
import { refreshMeetingLists } from "@/hooks/useMeetings";
import { api, ApiError } from "@/lib/api";
import {
  nextHalfHour,
  randomPasscode,
  TIME_OPTIONS,
  timezoneLabel,
  toDateInput,
  toIso,
  toTimeValue,
} from "@/lib/schedule";
import type { Meeting, MeetingSettings, Recurrence } from "@/lib/types";
import type { UserSettings } from "@/lib/workspaceTypes";
import { ScheduledMeetingDetails } from "./ScheduledMeetingDetails";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass a meeting to edit it; omit to schedule a new one. */
  meeting?: Meeting | null;
  /** Pre-filled start time for a new meeting (Calendar: clicking an empty slot). */
  initialStart?: Date | null;
}

export function ScheduleMeetingDialog({ open, onClose, meeting, initialStart }: Props) {
  const [saved, setSaved] = useState<Meeting | null>(null);
  const { data: defaults, error: defaultsError } = useUserSettings();
  const defaultsLoaded = defaults !== undefined || defaultsError !== undefined;
  const close = () => {
    setSaved(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={saved ? "Meeting scheduled" : meeting ? "Edit meeting" : "Schedule meeting"}
      className="max-w-xl"
    >
      {saved ? (
        <ScheduledMeetingDetails meeting={saved} onDone={close} />
      ) : !defaultsLoaded ? (
        // Wait for Settings defaults (duration, waiting room...) so the form starts with the right values
        <div className="h-96 animate-pulse rounded-lg bg-surface-hover" />
      ) : (
        <ScheduleForm meeting={meeting ?? null} initialStart={initialStart ?? null} onCancel={close} onSaved={(m) => (meeting ? close() : setSaved(m))} />
      )}
    </Modal>
  );
}

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, h) => h);
const MINUTE_OPTIONS = [0, 15, 30, 45];

type Settings = MeetingSettings;

function initialValues(meeting: Meeting | null, hostName?: string, initialStart?: Date | null, defaults?: UserSettings) {
  const start = meeting?.scheduled_start ? new Date(meeting.scheduled_start) : (initialStart ?? nextHalfHour());
  const duration = meeting?.duration_min ?? defaults?.default_duration_min ?? 60;
  return {
    title: meeting?.title ?? (hostName ? `${hostName}'s Zoom Meeting` : "My Meeting"),
    description: meeting?.description ?? "",
    date: toDateInput(start),
    time: toTimeValue(start),
    hours: Math.floor(duration / 60),
    minutes: duration % 60,
    passcode: meeting?.passcode ?? randomPasscode(),
    recurrence: (meeting?.recurrence ?? "none") as Recurrence,
    recurrenceEnd: meeting?.recurrence_end ?? "",
    settings: {
      waiting_room: meeting?.settings.waiting_room ?? defaults?.default_waiting_room ?? false,
      mute_on_entry: meeting?.settings.mute_on_entry ?? defaults?.default_mute_on_entry ?? false,
      host_video_on: meeting?.settings.host_video_on ?? true,
      participant_video_on: meeting?.settings.participant_video_on ?? true,
      allow_chat: meeting?.settings.allow_chat ?? true,
      allow_screen_share: meeting?.settings.allow_screen_share ?? true,
      allow_unmute: meeting?.settings.allow_unmute ?? true,
      allow_rename: meeting?.settings.allow_rename ?? true,
    } as Settings,
  };
}

function ScheduleForm({
  meeting,
  initialStart,
  onCancel,
  onSaved,
}: {
  meeting: Meeting | null;
  initialStart: Date | null;
  onCancel: () => void;
  onSaved: (m: Meeting) => void;
}) {
  const toast = useToast();
  const { user } = useCurrentUser();
  const { data: defaults } = useUserSettings();
  const [values, setValues] = useState(() => initialValues(meeting, user?.name, initialStart, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setSetting = (key: keyof Settings, value: boolean) =>
    setValues((v) => ({ ...v, settings: { ...v.settings, [key]: value } }));

  // The chosen time may not be a 15-minute slot (e.g. editing a meeting at 10:10), so keep it selectable.
  const timeOptions = TIME_OPTIONS.some((o) => o.value === values.time)
    ? TIME_OPTIONS
    : [{ value: values.time, label: values.time }, ...TIME_OPTIONS];

  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = "Please enter a topic.";
    if (!values.date) next.when = "Please choose a date.";
    else if (new Date(`${values.date}T${values.time}`).getTime() < Date.now() - 60_000)
      next.when = "The start time must be in the future.";
    if (values.hours * 60 + values.minutes < 15) next.duration = "Duration must be at least 15 minutes.";
    if (!/^[A-Za-z0-9]{1,10}$/.test(values.passcode)) next.passcode = "Use 1 to 10 letters or numbers.";
    if (values.recurrence !== "none" && values.recurrenceEnd && values.recurrenceEnd < values.date)
      next.recurrence = "The end date must be on or after the first meeting.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      scheduled_start: toIso(values.date, values.time),
      duration_min: values.hours * 60 + values.minutes,
      passcode: values.passcode,
      settings: values.settings,
      recurrence: values.recurrence,
      recurrence_end: values.recurrence !== "none" && values.recurrenceEnd ? values.recurrenceEnd : null,
    };
    try {
      const result = meeting ? await api.update(meeting.meeting_code, payload) : await api.schedule(payload);
      await refreshMeetingLists();
      toast(meeting ? "Meeting updated" : "Meeting scheduled");
      onSaved(result);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save the meeting.", "error");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="s-topic">Topic</Label>
        <TextInput
          id="s-topic"
          value={values.title}
          maxLength={200}
          onChange={(e) => set("title", e.target.value)}
          aria-invalid={!!errors.title}
        />
        <FieldError>{errors.title}</FieldError>
      </div>

      <div>
        <Label htmlFor="s-desc">Description (optional)</Label>
        <TextArea
          id="s-desc"
          value={values.description}
          maxLength={2000}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Enter a meeting description"
        />
      </div>

      <div>
        <Label htmlFor="s-date">When</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            id="s-date"
            type="date"
            value={values.date}
            min={toDateInput(new Date())}
            onChange={(e) => set("date", e.target.value)}
            aria-invalid={!!errors.when}
            className="sm:flex-1"
          />
          <Select
            aria-label="Start time"
            value={values.time}
            onChange={(e) => set("time", e.target.value)}
            className="sm:w-36"
          >
            {timeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <FieldError>{errors.when}</FieldError>
        <p className="mt-1.5 text-xs text-ink-muted">Time zone: {timezoneLabel()}</p>
      </div>

      <div>
        <Label>Duration</Label>
        <div className="flex items-center gap-2 text-sm">
          <Select
            aria-label="Hours"
            value={values.hours}
            onChange={(e) => set("hours", Number(e.target.value))}
            className="w-20"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
          <span className="text-ink-muted">hr</span>
          <Select
            aria-label="Minutes"
            value={values.minutes}
            onChange={(e) => set("minutes", Number(e.target.value))}
            className="w-20"
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <span className="text-ink-muted">min</span>
        </div>
        <FieldError>{errors.duration}</FieldError>
      </div>

      <div className="space-y-2">
        <Checkbox
          checked={values.recurrence !== "none"}
          onChange={(on) => set("recurrence", on ? "weekly" : "none")}
          label="Recurring meeting"
          hint="Same Meeting ID and link every time."
        />
        {values.recurrence !== "none" && (
          <div className="flex flex-col gap-2 pl-6 sm:flex-row sm:items-center">
            <Select
              aria-label="Recurrence"
              value={values.recurrence}
              onChange={(e) => set("recurrence", e.target.value as Recurrence)}
              className="sm:w-36"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
            <span className="text-sm text-ink-muted">until</span>
            <TextInput
              type="date"
              aria-label="End date"
              value={values.recurrenceEnd}
              min={values.date}
              onChange={(e) => set("recurrenceEnd", e.target.value)}
              className="sm:w-44"
            />
            <span className="text-xs text-ink-muted">(optional)</span>
          </div>
        )}
        <FieldError>{errors.recurrence}</FieldError>
      </div>

      <Section title="Security">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm">Passcode</span>
          <TextInput
            aria-label="Passcode"
            value={values.passcode}
            maxLength={10}
            onChange={(e) => set("passcode", e.target.value)}
            aria-invalid={!!errors.passcode}
            className="sm:w-40"
          />
        </div>
        <FieldError>{errors.passcode}</FieldError>
        <p className="text-xs text-ink-muted">Only users who have the invite link or passcode can join the meeting.</p>
        <Checkbox
          checked={values.settings.waiting_room}
          onChange={(v) => setSetting("waiting_room", v)}
          label="Waiting Room"
          hint="Only users admitted by the host can join the meeting."
        />
      </Section>

      <Section title="Video">
        <SettingRow label="Host">
          <RadioGroup
            name="host-video"
            value={values.settings.host_video_on ? "on" : "off"}
            onChange={(v) => setSetting("host_video_on", v === "on")}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Participant">
          <RadioGroup
            name="participant-video"
            value={values.settings.participant_video_on ? "on" : "off"}
            onChange={(v) => setSetting("participant_video_on", v === "on")}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </SettingRow>
      </Section>

      <Section title="Options">
        <Checkbox
          checked={values.settings.mute_on_entry}
          onChange={(v) => setSetting("mute_on_entry", v)}
          label="Mute participants upon entry"
        />
        <Checkbox
          checked={values.settings.allow_chat}
          onChange={(v) => setSetting("allow_chat", v)}
          label="Allow participants to chat"
        />
        <Checkbox
          checked={values.settings.allow_screen_share}
          onChange={(v) => setSetting("allow_screen_share", v)}
          label="Allow participants to share their screen"
        />
      </Section>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="soft" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} className="min-w-20">
          Save
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2.5 border-t border-line pt-4">
      <h3 className="text-[13px] font-bold">{title}</h3>
      {children}
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="w-24 text-ink-muted">{label}</span>
      {children}
    </div>
  );
}
