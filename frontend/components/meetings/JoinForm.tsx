"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, FieldError, Label, TextInput } from "@/components/ui/Field";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api";
import { saveJoinIntent } from "@/lib/joinIntent";
import { parseMeetingInput } from "@/lib/meetingLink";
import { prefs } from "@/lib/storage";

export interface JoinFormProps {
  /** Set when the meeting is already known (invite link page): the ID field is hidden. */
  presetCode?: string;
  presetPasscode?: string;
  /** "share" = Zoom's Share screen tile: joins with camera off and starts sharing. */
  mode?: "join" | "share";
  onCancel?: () => void;
}

type Stage = "details" | "passcode";

/**
 * Zoom's join flow: Meeting ID (or link) + name + audio/video options, then a passcode step if needed.
 * On success it saves the choices (see lib/joinIntent) and opens /meeting/{code}.
 */
export function JoinForm({ presetCode, presetPasscode, mode = "join", onCancel }: JoinFormProps) {
  const router = useRouter();
  const { user } = useCurrentUser();

  const [idInput, setIdInput] = useState(presetCode ?? "");
  // null = not edited yet: show the remembered name, or your account name once it has loaded
  const [name, setName] = useState<string | null>(() => prefs.rememberedName());
  const [remember, setRemember] = useState(() => prefs.rememberedName() !== null);
  const [noAudio, setNoAudio] = useState(false);
  const [videoOff, setVideoOff] = useState(mode === "share");

  const [stage, setStage] = useState<Stage>("details");
  const [code, setCode] = useState(presetCode ?? "");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<{ field: "id" | "name" | "passcode"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // The signed-in user's name is the default, like Zoom's desktop app.
  const nameValue = name ?? user?.name ?? "";
  const displayName = (nameValue || (mode === "share" ? user?.name ?? "Guest" : "")).trim();
  // Don't allow Join before we know your name (the profile is still loading on a slow connection)
  const profileLoading = name === null && !user;

  const enterMeeting = (meetingCode: string, meetingPasscode?: string) => {
    prefs.setRememberedName(remember ? displayName : null);
    saveJoinIntent(meetingCode, {
      displayName,
      passcode: meetingPasscode,
      asHost: false,
      audioOn: !noAudio,
      videoOn: !videoOff,
      shareOnJoin: mode === "share",
    });
    router.push(`/meeting/${meetingCode}`);
  };

  const verify = async (meetingCode: string, meetingPasscode?: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.verify(meetingCode, meetingPasscode);
      enterMeeting(meetingCode, meetingPasscode);
    } catch (e) {
      setLoading(false);
      if (!(e instanceof ApiError)) throw e;
      if (e.code === "passcode_required" || e.code === "wrong_passcode") {
        const wasOnPasscodeStep = stage === "passcode";
        setStage("passcode");
        // A wrong passcode typed by the user (or inside a link) is shown as an error; a missing one is not.
        if (wasOnPasscodeStep || meetingPasscode) setError({ field: "passcode", message: e.message });
      } else {
        setError({ field: stage === "passcode" ? "passcode" : "id", message: e.message });
      }
    }
  };

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseMeetingInput(idInput);
    if (!parsed) {
      return setError({ field: "id", message: "Please enter a valid meeting ID (9 to 11 digits) or invite link." });
    }
    if (!displayName) return setError({ field: "name", message: "Please enter your name." });
    setCode(parsed.code);
    verify(parsed.code, parsed.passcode ?? presetPasscode);
  };

  const submitPasscode = (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return setError({ field: "passcode", message: "Please enter the meeting passcode." });
    verify(code, passcode.trim());
  };

  if (stage === "passcode") {
    return (
      <form onSubmit={submitPasscode} noValidate>
        <p className="mb-4 text-sm text-ink-muted">This meeting requires a passcode.</p>
        <Label htmlFor="join-passcode">Meeting passcode</Label>
        <TextInput
          id="join-passcode"
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          aria-invalid={error?.field === "passcode"}
          placeholder="Enter meeting passcode"
        />
        <FieldError>{error?.field === "passcode" && error.message}</FieldError>
        <FormButtons loading={loading} submitLabel="Join" disabled={!passcode.trim()} onCancel={onCancel} />
      </form>
    );
  }

  return (
    <form onSubmit={submitDetails} noValidate className="space-y-4">
      {!presetCode && (
        <div>
          <Label htmlFor="join-id">{mode === "share" ? "Meeting ID" : "Meeting ID or personal link name"}</Label>
          <TextInput
            id="join-id"
            autoFocus
            inputMode="text"
            autoComplete="off"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="Enter meeting ID or invite link"
            aria-invalid={error?.field === "id"}
          />
          <FieldError>{error?.field === "id" && error.message}</FieldError>
        </div>
      )}
      {presetCode && <FieldError>{error?.field === "id" && error.message}</FieldError>}

      {mode === "join" && (
        <div>
          <Label htmlFor="join-name">Your name</Label>
          <TextInput
            id="join-name"
            value={nameValue}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder={profileLoading ? "Loading your name…" : "Enter your name"}
            aria-invalid={error?.field === "name"}
            autoFocus={!!presetCode}
          />
          <FieldError>{error?.field === "name" && error.message}</FieldError>
        </div>
      )}

      {mode === "join" && (
        <div className="space-y-2.5 pt-1">
          <Checkbox checked={remember} onChange={setRemember} label="Remember my name for future meetings" />
          <Checkbox checked={noAudio} onChange={setNoAudio} label="Don't connect to audio" />
          <Checkbox checked={videoOff} onChange={setVideoOff} label="Turn off my video" />
        </div>
      )}

      <p className="text-xs text-ink-muted">
        By clicking &quot;{mode === "share" ? "Share" : "Join"}&quot;, you agree to our Terms of Service and Privacy
        Statement.
      </p>

      <FormButtons
        loading={loading}
        submitLabel={mode === "share" ? "Share" : "Join"}
        disabled={!idInput.trim() || (mode === "join" && profileLoading)}
        onCancel={onCancel}
      />
    </form>
  );
}

function FormButtons({
  loading,
  submitLabel,
  disabled,
  onCancel,
}: {
  loading: boolean;
  submitLabel: string;
  disabled: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      {onCancel && (
        <Button variant="soft" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button type="submit" loading={loading} disabled={disabled} className="min-w-20">
        {submitLabel}
      </Button>
    </div>
  );
}
