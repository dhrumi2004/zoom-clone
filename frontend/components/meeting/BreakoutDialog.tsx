"use client";

import { Shuffle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import type { MeetingClient } from "@/lib/meeting/client";
import type { BreakoutState } from "@/lib/meeting/types";
import type { TileInfo } from "./VideoTile";

interface Props {
  open: boolean;
  onClose: () => void;
  client: MeetingClient;
  breakout: BreakoutState;
  /** Everyone in the main room (to assign) */
  people: TileInfo[];
  myRoomId: number;
}

/** Zoom Breakout Rooms: create rooms, assign automatically or by hand, open, visit, close. */
export function BreakoutDialog({ open, onClose, client, breakout, people, myRoomId }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Breakout Rooms" className="max-w-lg">
      {breakout.open ? (
        <OpenRooms client={client} breakout={breakout} people={people} myRoomId={myRoomId} onClose={onClose} />
      ) : (
        <Setup client={client} people={people.filter((p) => !p.isSelf && !p.isHost && !p.isCohost)} onClose={onClose} />
      )}
    </Modal>
  );
}

function Setup({ client, people, onClose }: { client: MeetingClient; people: TileInfo[]; onClose: () => void }) {
  const [count, setCount] = useState(Math.min(2, Math.max(1, people.length)));
  const [names, setNames] = useState<string[]>(() => Array.from({ length: 10 }, (_, i) => `Room ${i + 1}`));
  // participant id -> room number (1-based); 0 = stays in the main room
  const [assign, setAssign] = useState<Record<number, number>>({});

  const autoAssign = () => {
    const shuffled = [...people].sort(() => Math.random() - 0.5);
    setAssign(Object.fromEntries(shuffled.map((p, i) => [p.id, (i % count) + 1])));
  };

  const openRooms = () => {
    const rooms = Array.from({ length: count }, (_, i) => ({
      name: names[i].trim() || `Room ${i + 1}`,
      participant_ids: people.filter((p) => assign[p.id] === i + 1).map((p) => p.id),
    }));
    client.openBreakouts(rooms);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="w-32">
          <Label htmlFor="br-count">Number of rooms</Label>
          <Select id="br-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" onClick={autoAssign} disabled={!people.length}>
          <Shuffle className="size-4" /> Assign automatically
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <TextInput
            key={i}
            aria-label={`Room ${i + 1} name`}
            value={names[i]}
            maxLength={60}
            onChange={(e) => setNames((n) => n.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
      </div>

      <div>
        <Label>Assign participants</Label>
        <div className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate">{p.name}</span>
              <Select
                aria-label={`Room for ${p.name}`}
                value={assign[p.id] ?? 0}
                onChange={(e) => setAssign((a) => ({ ...a, [p.id]: Number(e.target.value) }))}
                className="w-40"
              >
                <option value={0}>Main room</option>
                {Array.from({ length: count }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {names[i] || `Room ${i + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          {!people.length && <p className="px-3 py-4 text-center text-sm text-ink-muted">No participants to assign yet.</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={openRooms}>Open all rooms</Button>
      </div>
    </div>
  );
}

function OpenRooms({
  client,
  breakout,
  people,
  myRoomId,
  onClose,
}: {
  client: MeetingClient;
  breakout: BreakoutState;
  people: TileInfo[];
  myRoomId: number;
  onClose: () => void;
}) {
  const inRooms = new Set(breakout.rooms.flatMap((r) => r.participants.map((p) => p.id)));
  const unassigned = people.filter((p) => !inRooms.has(p.id) && !p.isSelf);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {breakout.rooms.map((room) => (
          <div key={room.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">
                {room.name} <span className="font-normal text-ink-muted">({room.participants.length})</span>
              </p>
              {myRoomId === room.id ? (
                <span className="text-xs font-bold text-success">You&apos;re here</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => client.joinBreakout(room.id)}>
                  Join
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{room.participants.map((p) => p.display_name).join(", ") || "Empty"}</p>
          </div>
        ))}
      </div>

      {!!unassigned.length && (
        <div>
          <Label>In the main room</Label>
          <div className="divide-y divide-line rounded-lg border border-line">
            {unassigned.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{p.name}</span>
                <Select aria-label={`Move ${p.name}`} value={0} onChange={(e) => client.assignBreakout(p.id, Number(e.target.value))} className="w-40">
                  <option value={0}>Move to…</option>
                  {breakout.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {myRoomId !== 0 && (
          <Button variant="secondary" onClick={() => client.joinBreakout(0)}>
            Return to main room
          </Button>
        )}
        <Button
          variant="danger"
          onClick={() => {
            client.closeBreakouts();
            onClose();
          }}
        >
          Close all rooms
        </Button>
      </div>
    </div>
  );
}
