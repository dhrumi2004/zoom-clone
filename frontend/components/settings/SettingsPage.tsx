"use client";

import clsx from "clsx";
import { Keyboard, Mic, UserRound, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Label, Select, Switch, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserSettings } from "@/hooks/useUserSettings";
import { api, ApiError, keys } from "@/lib/api";
import { formatDuration, formatMeetingCode } from "@/lib/format";
import { prefs } from "@/lib/storage";
import type { User } from "@/lib/types";
import type { Profile, UserSettings } from "@/lib/workspaceTypes";

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "video", label: "Video & Audio", icon: Mic },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Settings with tabs in the URL (?tab=meetings), like Zoom's settings window. */
export function SettingsPage() {
  const router = useRouter();
  const requested = useSearchParams().get("tab");
  const tab = (TABS.find((t) => t.id === requested)?.id ?? "profile") as TabId;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-56 md:flex-col" aria-label="Settings sections">
        <h1 className="mb-3 hidden px-3 text-2xl font-bold md:block">Settings</h1>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.replace(`/settings?tab=${t.id}`)}
            className={clsx(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
              tab === t.id ? "bg-zoom-blue-soft font-bold text-zoom-blue" : "text-ink hover:bg-surface-hover",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </nav>
      <section className="min-w-0 flex-1">
        {tab === "profile" && <ProfileTab />}
        {tab === "meetings" && <MeetingsTab />}
        {tab === "video" && <VideoAudioTab />}
        {tab === "shortcuts" && <ShortcutsTab />}
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-5">
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}

// ---------- Profile ----------

const AVATAR_COLORS = ["#0E72ED", "#8B5CF6", "#F97316", "#10B981", "#EF4444", "#EAB308", "#EC4899", "#14B8A6"];

function ProfileTab() {
  const { user } = useCurrentUser();
  const { data: profile } = useSWR(keys.profile, api.getProfile);
  if (!user || !profile) return <div className="h-80 animate-pulse rounded-xl bg-surface-hover" />;
  return <ProfileForm key={user.id} user={user} profile={profile} />;
}

function ProfileForm({ user, profile }: { user: User; profile: Profile }) {
  const toast = useToast();
  const [values, setValues] = useState({
    name: user.name,
    avatar_color: user.avatar_color,
    job_title: profile.job_title ?? "",
    department: profile.department ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return toast("Name can't be empty", "error");
    setSaving(true);
    try {
      await api.updateMe(values);
      await Promise.all([mutate(keys.me), mutate(keys.profile)]);
      toast("Profile saved");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save your profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card title="Profile picture">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={values.name || "?"} color={values.avatar_color} size="xl" />
          <div>
            <p className="mb-2 text-sm text-ink-muted">Choose a color</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Avatar color ${c}`}
                  aria-pressed={values.avatar_color === c}
                  onClick={() => setValues((v) => ({ ...v, avatar_color: c }))}
                  className={clsx("size-8 rounded-lg", values.avatar_color === c && "ring-2 ring-zoom-blue ring-offset-2")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Personal information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-name" label="Display name" value={values.name} onChange={set("name")} maxLength={100} />
          <div>
            <Label>Email</Label>
            <TextInput value={user.email} disabled />
          </div>
          <Field id="p-title" label="Job title" value={values.job_title} onChange={set("job_title")} maxLength={100} />
          <Field id="p-dept" label="Department" value={values.department} onChange={set("department")} maxLength={100} />
          <Field id="p-phone" label="Phone" value={values.phone} onChange={set("phone")} maxLength={30} />
          <Field id="p-loc" label="Location" value={values.location} onChange={set("location")} maxLength={100} />
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          Personal Meeting ID: <span className="text-ink">{formatMeetingCode(user.personal_meeting_id)}</span>
        </p>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <TextInput id={id} {...props} />
    </div>
  );
}

// ---------- Meetings ----------

const DURATIONS = [15, 30, 45, 60, 90, 120];

function MeetingsTab() {
  const toast = useToast();
  const { data: settings, mutate: mutateSettings } = useUserSettings();
  if (!settings) return <div className="h-80 animate-pulse rounded-xl bg-surface-hover" />;

  // Settings save as soon as they change, like Zoom's settings page.
  const update = async (change: Partial<UserSettings>) => {
    try {
      await mutateSettings(api.updateSettings(change), { optimisticData: { ...settings, ...change }, revalidate: false });
      toast("Setting saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save the setting.", "error");
      void mutateSettings();
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Joining a meeting">
        <div className="divide-y divide-line">
          <Switch
            checked={settings.start_with_video}
            onChange={(v) => update({ start_with_video: v })}
            label="Start meetings with my video on"
            hint="Also available from the arrow next to New meeting."
          />
          <Switch
            checked={settings.mute_on_join}
            onChange={(v) => update({ mute_on_join: v })}
            label="Mute my microphone when joining a meeting"
          />
        </div>
      </Card>
      <Card title="Defaults for new scheduled meetings">
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between gap-6 py-3 text-sm">
            <span>Default duration</span>
            <Select
              aria-label="Default duration"
              value={settings.default_duration_min}
              onChange={(e) => update({ default_duration_min: Number(e.target.value) })}
              className="w-36"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </Select>
          </div>
          <Switch
            checked={settings.default_waiting_room}
            onChange={(v) => update({ default_waiting_room: v })}
            label="Waiting Room"
            hint="Guests wait until you admit them."
          />
          <Switch
            checked={settings.default_mute_on_entry}
            onChange={(v) => update({ default_mute_on_entry: v })}
            label="Mute participants upon entry"
          />
        </div>
      </Card>
    </div>
  );
}

// ---------- Video & Audio ----------

function VideoAudioTab() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState(() => prefs.cameraId() ?? "");
  const [micId, setMicId] = useState(() => prefs.micId() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live preview of the chosen camera + microphone level. Devices are released when leaving the tab.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : true,
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        setError(null);
        if (videoRef.current) videoRef.current.srcObject = stream;
        // Device names are only visible after permission is granted.
        setDevices(await navigator.mediaDevices.enumerateDevices());

        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += v * v;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) setError("Couldn't access your camera or microphone. Check your browser's permission settings.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [cameraId, micId]);

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");

  return (
    <div className="space-y-6">
      <Card title="Camera">
        <div className="aspect-video w-full max-w-lg overflow-hidden rounded-xl bg-meeting-tile">
          <video ref={videoRef} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
        </div>
        <div className="mt-4 max-w-lg">
          <Label htmlFor="cam">Camera</Label>
          <Select
            id="cam"
            value={cameraId}
            onChange={(e) => {
              setCameraId(e.target.value);
              prefs.setCameraId(e.target.value);
            }}
          >
            <option value="">Same as system</option>
            {cameras.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card title="Microphone">
        <div className="max-w-lg space-y-3">
          <div>
            <Label htmlFor="mic">Microphone</Label>
            <Select
              id="mic"
              value={micId}
              onChange={(e) => {
                setMicId(e.target.value);
                prefs.setMicId(e.target.value);
              }}
            >
              <option value="">Same as system</option>
              {mics.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-ink-muted">Input level: speak to test your microphone</p>
            <div className="flex gap-1" aria-label="Microphone level">
              {Array.from({ length: 20 }, (_, i) => (
                <span key={i} className={clsx("h-2 flex-1 rounded-sm", i / 20 < level ? "bg-success" : "bg-surface-hover")} />
              ))}
            </div>
          </div>
        </div>
      </Card>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-ink-muted">Your choice is saved in this browser and used the next time you join a meeting.</p>
    </div>
  );
}

// ---------- Shortcuts ----------

function ShortcutsTab() {
  const rows = [
    ["Alt + A", "Mute / unmute my audio"],
    ["Alt + V", "Start / stop my video"],
    ["Enter", "Send a chat message"],
    ["Shift + Enter", "New line in a chat message"],
    ["Esc", "Close a dialog or menu"],
  ];
  return (
    <Card title="Keyboard shortcuts">
      <dl className="divide-y divide-line text-sm">
        {rows.map(([key, action]) => (
          <div key={key} className="flex items-center justify-between py-2.5">
            <dt>{action}</dt>
            <dd>
              <kbd className="rounded-md border border-line bg-surface-muted px-2 py-0.5 font-sans text-xs">{key}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
