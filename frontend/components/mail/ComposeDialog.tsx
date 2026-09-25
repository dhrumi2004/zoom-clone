"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, TextArea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";

export interface Draft {
  to: string;
  subject: string;
  body: string;
}

/** New message / reply. Recipients are comma-separated addresses. */
export function ComposeDialog({ draft, onClose, onSent }: { draft: Draft | null; onClose: () => void; onSent: () => void }) {
  return (
    <Modal open={draft !== null} onClose={onClose} title="New message" className="max-w-2xl">
      {draft && <ComposeForm initial={draft} onCancel={onClose} onSent={onSent} />}
    </Modal>
  );
}

function ComposeForm({ initial, onCancel, onSent }: { initial: Draft; onCancel: () => void; onSent: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const to = draft.to.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (!to.length) return setError("Add at least one recipient.");
    const invalid = to.find((addr) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
    if (invalid) return setError(`"${invalid}" isn't a valid email address.`);
    setSending(true);
    try {
      await api.sendMail(to, draft.subject, draft.body);
      toast("Message sent");
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the message.");
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <TextInput aria-label="To" placeholder="To" value={draft.to} onChange={set("to")} autoFocus={!initial.to} aria-invalid={!!error} />
        <FieldError>{error}</FieldError>
      </div>
      <TextInput aria-label="Subject" placeholder="Subject" value={draft.subject} maxLength={300} onChange={set("subject")} />
      <TextArea aria-label="Message" value={draft.body} onChange={set("body")} maxLength={20000} className="min-h-64" autoFocus={!!initial.to} />
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onCancel}>
          Discard
        </Button>
        <Button type="submit" loading={sending}>
          Send
        </Button>
      </div>
    </form>
  );
}
