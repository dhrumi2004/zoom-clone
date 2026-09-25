"use client";

import { SendHorizontal } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { colorForName, formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/meeting/types";

const MAX_LENGTH = 2000;

interface Props {
  messages: ChatMessage[];
  selfId: number | null;
  /** Everyone else in the room, for private messages */
  people: { id: number; name: string; isModerator: boolean }[];
  /** False when the host limited chat to hosts/co-hosts (participants can still message them privately) */
  canChatEveryone: boolean;
  onSend: (text: string, toId: number | null) => void;
}

/** Zoom's Meeting Chat: to Everyone or privately to one person. Enter sends, Shift+Enter adds a new line. */
export function ChatPanel({ messages, selfId, people, canChatEveryone, onSend }: Props) {
  const [text, setText] = useState("");
  const [to, setTo] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recipients = canChatEveryone ? people : people.filter((p) => p.isModerator);
  // If the chosen person left (or chat got restricted), fall back to a valid recipient
  const target = to !== null && recipients.some((p) => p.id === to) ? to : canChatEveryone ? null : (recipients[0]?.id ?? null);
  const canSend = canChatEveryone || target !== null;

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || !canSend) return;
    onSend(text, target);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!messages.length && (
          <p className="pt-10 text-center text-sm text-ink-muted">Messages sent here are visible to everyone in the meeting.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.participant_id === selfId;
          const isPrivate = m.recipient_id !== null;
          // Group consecutive messages from the same person (and same audience) under one header, like Zoom.
          const prev = messages[i - 1];
          const grouped = !!prev && prev.participant_id === m.participant_id && prev.recipient_id === m.recipient_id;
          return (
            <div key={m.id} className="flex gap-2">
              <span className="w-7 shrink-0">
                {!grouped && <Avatar name={m.sender_name} color={colorForName(m.sender_name)} size="sm" />}
              </span>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="text-xs text-ink-muted">
                    <span className="font-bold text-ink">{mine ? "Me" : m.sender_name}</span>
                    {isPrivate && (
                      <span className="text-danger">
                        {" "}
                        to {m.recipient_id === selfId ? "Me" : m.recipient_name} (Direct Message)
                      </span>
                    )}
                    <span className="ml-1.5">{formatTime(m.sent_at)}</span>
                  </p>
                )}
                <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-line p-3">
        <label className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          To:
          <select
            value={target ?? ""}
            onChange={(e) => setTo(e.target.value ? Number(e.target.value) : null)}
            className="rounded bg-zoom-blue-soft px-1.5 py-0.5 font-bold text-zoom-blue outline-none"
          >
            {canChatEveryone && <option value="">Everyone</option>}
            {recipients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isModerator ? " (Host)" : ""}
              </option>
            ))}
          </select>
          {target !== null && <span className="text-danger">(Direct Message)</span>}
        </label>
        {canSend ? (
          <div className="flex items-end gap-2 rounded-lg border border-line px-2.5 py-2 focus-within:border-zoom-blue">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Type message here…"
              aria-label="Chat message"
              className="max-h-32 min-h-10 w-full resize-none bg-transparent text-sm outline-none placeholder:text-ink-subtle focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Send message"
              className="rounded-md p-1 text-zoom-blue hover:bg-zoom-blue-soft disabled:text-ink-subtle disabled:hover:bg-transparent"
            >
              <SendHorizontal className="size-5" />
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-ink-muted">The host has disabled chat for participants.</p>
        )}
      </form>
    </div>
  );
}
