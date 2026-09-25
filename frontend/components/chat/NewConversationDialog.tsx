"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox, FieldError, Label, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError, keys } from "@/lib/api";
import type { Channel } from "@/lib/workspaceTypes";

interface Props {
  mode: "channel" | "direct" | null;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

/** "New channel" (name + members) or "New chat" (pick one person). */
export function NewConversationDialog({ mode, onClose, onCreated }: Props) {
  return (
    <Modal open={mode !== null} onClose={onClose} title={mode === "channel" ? "Create a channel" : "New chat"}>
      {mode === "channel" ? <ChannelForm onCreated={onCreated} onCancel={onClose} /> : <DirectPicker onCreated={onCreated} />}
    </Modal>
  );
}

function ChannelForm({ onCreated, onCancel }: { onCreated: (c: Channel) => void; onCancel: () => void }) {
  const { data: contacts } = useSWR(keys.contacts, api.getContacts);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter a channel name.");
    setSaving(true);
    try {
      onCreated(await api.createChannel(name, members, description));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the channel.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="ch-name">Channel name</Label>
        <TextInput id="ch-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. marketing" />
        <FieldError>{error}</FieldError>
      </div>
      <div>
        <Label htmlFor="ch-desc">Description (optional)</Label>
        <TextInput id="ch-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label>Add members</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-line p-3">
          {contacts?.map((c) => (
            <Checkbox
              key={c.user_id}
              checked={members.includes(c.user_id)}
              onChange={(on) => setMembers((m) => (on ? [...m, c.user_id] : m.filter((id) => id !== c.user_id)))}
              label={c.name}
              hint={c.job_title ?? undefined}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Create
        </Button>
      </div>
    </form>
  );
}

function DirectPicker({ onCreated }: { onCreated: (c: Channel) => void }) {
  const { data: contacts } = useSWR(keys.contacts, api.getContacts);
  const [query, setQuery] = useState("");
  const shown = contacts?.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())) ?? [];

  return (
    <div className="space-y-3">
      <TextInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" aria-label="Search contacts" />
      <ul className="max-h-72 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.user_id}>
            <button
              type="button"
              onClick={async () => onCreated(await api.openDirect(c.user_id))}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
            >
              <Avatar name={c.name} color={c.avatar_color} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{c.name}</span>
                <span className="block truncate text-xs text-ink-muted">{c.job_title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
