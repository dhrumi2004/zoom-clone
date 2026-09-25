"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

export function RenameDialog({
  person,
  onClose,
  onSave,
}: {
  person: { id: number; name: string } | null;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <Modal open={person !== null} onClose={onClose} title="Rename">
      {person && <RenameForm initial={person.name} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function RenameForm({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="rename">Enter a new name</Label>
        <TextInput id="rename" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          Change
        </Button>
      </div>
    </form>
  );
}
