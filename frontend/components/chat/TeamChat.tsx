"use client";

import clsx from "clsx";
import { ArrowLeft, Hash, MessageSquarePlus, Plus, Search, SendHorizontal, Users, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { DayDivider, FullHeight } from "@/components/workspace/PageShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api, ApiError, keys } from "@/lib/api";
import { formatRelativeDay, formatTime } from "@/lib/format";
import type { Channel, ChannelMessage } from "@/lib/workspaceTypes";
import { NewConversationDialog } from "./NewConversationDialog";

const POLL_MS = 3000; // new messages from others show up within a few seconds

/** Zoom Team Chat: channel/DM list on the left, conversation on the right. Selected chat lives in ?c=<id>. */
export function TeamChat() {
  const router = useRouter();
  const selectedId = Number(useSearchParams().get("c")) || null;
  const { data: channels } = useSWR(keys.channels, api.getChannels, { refreshInterval: POLL_MS * 2 });
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"channel" | "direct" | null>(null);

  const select = (id: number) => router.replace(`/chat?c=${id}`);
  const selected = channels?.find((c) => c.id === selectedId) ?? null;

  const filtered = (channels ?? []).filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const groups = [
    { title: "Channels", items: filtered.filter((c) => c.type === "channel") },
    { title: "Direct messages", items: filtered.filter((c) => c.type === "direct") },
  ];

  return (
    <FullHeight>
      <aside
        className={clsx(
          "flex w-full shrink-0 flex-col border-r border-line bg-surface-muted md:w-72",
          selectedId && "max-md:hidden",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold">Team Chat</h1>
          <DropdownMenu
            items={[
              { label: "New chat", icon: MessageSquarePlus, onSelect: () => setDialog("direct") },
              { label: "Create a channel", icon: Hash, onSelect: () => setDialog("channel") },
            ]}
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="New conversation"
                className="flex size-8 items-center justify-center rounded-lg bg-zoom-blue text-white hover:bg-zoom-blue-hover"
              >
                <Plus className="size-4" />
              </button>
            )}
          />
        </div>
        <label className="mx-4 mb-2 flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm">
          <Search className="size-4 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent outline-none focus-visible:outline-none"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {!channels && <p className="px-4 py-3 text-sm text-ink-muted">Loading…</p>}
          {groups.map((g) => (
            <section key={g.title} className="mt-2">
              <h2 className="px-4 py-1 text-xs font-bold text-ink-muted">{g.title}</h2>
              {g.items.map((c) => (
                <ChannelRow key={c.id} channel={c} active={c.id === selectedId} onClick={() => select(c.id)} />
              ))}
              {channels && !g.items.length && <p className="px-4 py-1 text-xs text-ink-subtle">None yet</p>}
            </section>
          ))}
        </div>
      </aside>

      <section className={clsx("flex min-w-0 flex-1 flex-col", !selectedId && "max-md:hidden")}>
        {selected ? (
          <Conversation key={selected.id} channel={selected} onBack={() => router.replace("/chat")} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <MessageSquarePlus className="size-12 text-ink-subtle" strokeWidth={1.25} />
            <p className="text-sm text-ink-muted">Select a conversation or start a new one.</p>
            <Button onClick={() => setDialog("direct")}>New chat</Button>
          </div>
        )}
      </section>

      <NewConversationDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        onCreated={(c) => {
          setDialog(null);
          void mutate(keys.channels);
          select(c.id);
        }}
      />
    </FullHeight>
  );
}

function ChannelRow({ channel, active, onClick }: { channel: Channel; active: boolean; onClick: () => void }) {
  const other = channel.members[1] ?? channel.members[0];
  const unread = channel.unread_count > 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm",
        active ? "bg-zoom-blue-soft text-zoom-blue" : "hover:bg-surface-hover",
      )}
    >
      {channel.type === "channel" ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
          <Hash className="size-4" />
        </span>
      ) : (
        <Avatar name={channel.name} color={other?.avatar_color ?? "#909096"} size="sm" />
      )}
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate", unread && "font-bold")}>{channel.name}</span>
        {channel.last_message && <span className="block truncate text-xs text-ink-muted">{channel.last_message}</span>}
      </span>
      {unread && (
        <span className="rounded-full bg-danger px-1.5 text-[10px] leading-4 font-bold text-white">{channel.unread_count}</span>
      )}
    </button>
  );
}

function Conversation({ channel, onBack }: { channel: Channel; onBack: () => void }) {
  const toast = useToast();
  const { user } = useCurrentUser();
  const { startInstant, creating } = useStartMeeting(user);
  const key = ["channel-messages", channel.id];
  const { data: messages } = useSWR(key, () => api.getChannelMessages(channel.id), { refreshInterval: POLL_MS });
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Opening a conversation marks it read on the server; refresh the list and tab badges.
  useEffect(() => {
    void mutate(keys.channels);
    void mutate(keys.badges);
  }, [channel.id, messages?.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages?.length]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    try {
      await api.sendChannelMessage(channel.id, content);
      await mutate(key);
    } catch (err) {
      setText(content);
      toast(err instanceof ApiError ? err.message : "Couldn't send the message.", "error");
    }
  };

  // Zoom's "Meet" button: start a meeting and drop the invite link into this chat.
  const meet = () =>
    startInstant(async (meeting) => {
      await api.sendChannelMessage(channel.id, `📹 Join my Zoom meeting: ${meeting.invite_link}`).catch(() => {});
    });

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) void send(e);
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded p-1 hover:bg-surface-hover md:hidden">
          <ArrowLeft className="size-5" />
        </button>
        {channel.type === "channel" ? <Hash className="size-5 text-ink-muted" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{channel.name}</h2>
          <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
            {channel.type === "channel" ? (
              <>
                <Users className="size-3" /> {channel.members.length} members
                {channel.description && ` · ${channel.description}`}
              </>
            ) : (
              "Direct message"
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={meet} loading={creating}>
          <Video className="size-4" /> Meet
        </Button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {messages?.map((m, i) => (
          <MessageRow key={m.id} message={m} previous={messages[i - 1]} mine={m.sender?.id === user?.id} />
        ))}
        {messages && !messages.length && (
          <p className="pt-16 text-center text-sm text-ink-muted">This is the start of your conversation with {channel.name}.</p>
        )}
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line px-3 py-2 focus-within:border-zoom-blue">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={4000}
            placeholder={`Message ${channel.type === "channel" ? "#" : ""}${channel.name}`}
            aria-label="Message"
            className="max-h-40 min-h-6 w-full resize-none bg-transparent text-sm outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className="rounded-md p-1 text-zoom-blue hover:bg-zoom-blue-soft disabled:text-ink-subtle"
          >
            <SendHorizontal className="size-5" />
          </button>
        </div>
      </form>
    </>
  );
}

function MessageRow({ message, previous, mine }: { message: ChannelMessage; previous?: ChannelMessage; mine: boolean }) {
  const day = formatRelativeDay(message.sent_at);
  const newDay = !previous || formatRelativeDay(previous.sent_at) !== day;
  // Consecutive messages from one person within 5 minutes share a header, like Zoom.
  const grouped =
    !newDay &&
    previous?.sender?.id === message.sender?.id &&
    new Date(message.sent_at).getTime() - new Date(previous!.sent_at).getTime() < 5 * 60_000;
  const name = message.sender?.name ?? "Deleted user";

  return (
    <>
      {newDay && <DayDivider label={day} />}
      <div className={clsx("group flex gap-3 rounded-lg px-2 hover:bg-surface-muted", grouped ? "py-0.5" : "mt-2 py-1")}>
        <span className="w-8 shrink-0">
          {!grouped && <Avatar name={name} color={message.sender?.avatar_color ?? "#909096"} size="sm" />}
        </span>
        <div className="min-w-0 flex-1">
          {!grouped && (
            <p className="text-xs">
              <span className="font-bold text-ink">{mine ? `${name} (You)` : name}</span>
              <span className="ml-2 text-ink-muted">{formatTime(message.sent_at)}</span>
            </p>
          )}
          <p className="text-sm break-words whitespace-pre-wrap">
            <Linkified text={message.content} />
          </p>
        </div>
      </div>
    </>
  );
}

/** Turns URLs in chat text into links (rendered as React elements, never as raw HTML). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-zoom-blue underline">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
