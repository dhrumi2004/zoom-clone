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
  /** False when the host turned chat off for participants */
  canChat: boolean;
  onSend: (text: string) => void;
}

/** Zoom's Meeting Chat: messages to Everyone, Enter to send, Shift+Enter for a new line. */
export function ChatPanel({ messages, selfId, canChat, onSend }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!messages.length && (
          <p className="pt-10 text-center text-sm text-ink-muted">
            Messages sent here are visible to everyone in the meeting.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.participant_id === selfId;
          // Group consecutive messages from the same person under one header, like Zoom.
          const grouped = i > 0 && messages[i - 1].participant_id === m.participant_id;
          return (
            <div key={m.id} className="flex gap-2">
              <span className="w-7 shrink-0">
                {!grouped && <Avatar name={m.sender_name} color={colorForName(m.sender_name)} size="sm" />}
              </span>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <p className="text-xs text-ink-muted">
                    <span className="font-bold text-ink">{mine ? "Me" : m.sender_name}</span>
                    <span className="ml-1.5">{formatTime(m.sent_at)}</span>
                  </p>
                )}
                <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {canChat ? (
        <form onSubmit={send} className="border-t border-line p-3">
          <p className="mb-1.5 text-xs text-ink-muted">
            To: <span className="rounded bg-zoom-blue-soft px-1.5 py-0.5 font-bold text-zoom-blue">Everyone</span>
          </p>
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
        </form>
      ) : (
        <p className="border-t border-line p-4 text-center text-xs text-ink-muted">The host has disabled chat for participants.</p>
      )}
    </div>
  );
}
