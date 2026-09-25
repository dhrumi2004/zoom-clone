"use client";

import clsx from "clsx";
import { ArrowLeft, Inbox, Mail as MailIcon, PenSquare, Reply, RotateCcw, Search, Send, Star, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { FullHeight } from "@/components/workspace/PageShell";
import { api, keys } from "@/lib/api";
import { colorForName, formatLongDate, formatRelativeDay, formatTime } from "@/lib/format";
import type { Email, MailFolder } from "@/lib/workspaceTypes";
import { ComposeDialog, Draft } from "./ComposeDialog";

const FOLDERS: { id: MailFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "trash", label: "Trash", icon: Trash2 },
];

/** Zoom Mail: folders | message list | reading pane. Folder and open message live in the URL. */
export function MailApp() {
  const router = useRouter();
  const params = useSearchParams();
  const folder = (FOLDERS.find((f) => f.id === params.get("folder"))?.id ?? "inbox") as MailFolder;
  const openId = Number(params.get("m")) || null;
  const [query, setQuery] = useState("");
  // /mail?compose=someone@x.com (from Contacts' "Email" button) opens a new message to them
  const composeTo = params.get("compose");
  const [draft, setDraft] = useState<Draft | null>(() => (composeTo ? { to: composeTo, subject: "", body: "" } : null));

  const listKey = ["mail", folder, query];
  const { data } = useSWR(listKey, () => api.getMail(folder, query), { refreshInterval: 30_000, keepPreviousData: true });
  const open = data?.items.find((m) => m.id === openId) ?? null;

  const go = (next: { folder?: MailFolder; m?: number | null }) => {
    const f = next.folder ?? folder;
    const m = next.m === undefined ? openId : next.m;
    router.replace(`/mail?folder=${f}${m ? `&m=${m}` : ""}`);
  };
  // Stable, so the reading pane's "mark as read" effect doesn't re-run on every render.
  const refresh = useCallback(
    () => Promise.all([mutate((k) => Array.isArray(k) && k[0] === "mail"), mutate(keys.badges)]),
    [],
  );

  return (
    <FullHeight>
      <aside className={clsx("flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-muted p-3", "max-lg:hidden")}>
        <Button onClick={() => setDraft({ to: "", subject: "", body: "" })} className="mb-3 w-full">
          <PenSquare className="size-4" /> Compose
        </Button>
        {FOLDERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => go({ folder: f.id, m: null })}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
              folder === f.id ? "bg-zoom-blue-soft font-bold text-zoom-blue" : "hover:bg-surface-hover",
            )}
          >
            <f.icon className="size-4" />
            <span className="flex-1">{f.label}</span>
            {f.id === "inbox" && !!data?.unread_inbox && <span className="text-xs font-bold">{data.unread_inbox}</span>}
          </button>
        ))}
      </aside>

      <section className={clsx("flex w-full shrink-0 flex-col border-r border-line lg:w-96", open && "max-lg:hidden")}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <select
            aria-label="Folder"
            value={folder}
            onChange={(e) => go({ folder: e.target.value as MailFolder, m: null })}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-sm lg:hidden"
          >
            {FOLDERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <label className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-line px-2.5 text-sm">
            <Search className="size-4 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full bg-transparent outline-none focus-visible:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setDraft({ to: "", subject: "", body: "" })}
            aria-label="Compose"
            className="flex size-8 items-center justify-center rounded-lg bg-zoom-blue text-white lg:hidden"
          >
            <PenSquare className="size-4" />
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {data?.items.map((m) => (
            <MailRow key={m.id} email={m} folder={folder} active={m.id === openId} onOpen={() => go({ m: m.id })} onChanged={refresh} />
          ))}
          {data && !data.items.length && (
            <li className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-ink-muted">
              <MailIcon className="size-10 text-ink-subtle" strokeWidth={1.25} />
              {query ? "No messages match your search." : "No messages here."}
            </li>
          )}
        </ul>
      </section>

      <section className={clsx("min-w-0 flex-1", !open && "max-lg:hidden")}>
        {open ? (
          <ReadingPane
            key={open.id}
            email={open}
            onBack={() => go({ m: null })}
            onChanged={refresh}
            onClosed={() => go({ m: null })}
            onReply={() =>
              setDraft({
                to: open.folder === "sent" ? open.to_emails : open.from_email,
                subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`,
                body: `\n\nOn ${formatLongDate(open.sent_at)}, ${open.from_name} wrote:\n> ${open.body.replace(/\n/g, "\n> ")}`,
              })
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">Select a message to read it.</div>
        )}
      </section>

      <ComposeDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSent={() => {
          setDraft(null);
          void refresh();
        }}
      />
    </FullHeight>
  );
}

function MailRow({
  email,
  folder,
  active,
  onOpen,
  onChanged,
}: {
  email: Email;
  folder: MailFolder;
  active: boolean;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const who = folder === "sent" ? `To: ${email.to_emails}` : email.from_name;
  const toggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api.updateMail(email.id, { is_starred: !email.is_starred });
    onChanged();
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className={clsx(
          "flex cursor-pointer gap-3 border-b border-line px-4 py-3",
          active ? "bg-zoom-blue-soft" : "hover:bg-surface-muted",
          !email.is_read && !active && "bg-surface",
        )}
      >
        <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", email.is_read ? "bg-transparent" : "bg-zoom-blue")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={clsx("flex-1 truncate text-sm", !email.is_read && "font-bold")}>{who}</span>
            <span className="shrink-0 text-xs text-ink-muted">
              {formatRelativeDay(email.sent_at) === "Today" ? formatTime(email.sent_at) : formatRelativeDay(email.sent_at)}
            </span>
          </div>
          <p className={clsx("truncate text-sm", !email.is_read ? "font-bold" : "text-ink")}>{email.subject}</p>
          <p className="truncate text-xs text-ink-muted">{email.body.replace(/\s+/g, " ")}</p>
        </div>
        <button type="button" onClick={toggleStar} aria-label={email.is_starred ? "Unstar" : "Star"} className="self-start p-0.5">
          <Star className={clsx("size-4", email.is_starred ? "fill-[#f5b400] text-[#f5b400]" : "text-ink-subtle")} />
        </button>
      </div>
    </li>
  );
}

function ReadingPane({
  email,
  onBack,
  onChanged,
  onClosed,
  onReply,
}: {
  email: Email;
  onBack: () => void;
  onChanged: () => void;
  onClosed: () => void;
  onReply: () => void;
}) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inTrash = email.folder === "trash";

  // Opening an unread message marks it read.
  useEffect(() => {
    if (!email.is_read) void api.updateMail(email.id, { is_read: true }).then(onChanged);
  }, [email.id, email.is_read, onChanged]);

  const act = async (action: "trash" | "restore") => {
    await api.updateMail(email.id, { action });
    toast(action === "trash" ? "Moved to Trash" : "Message restored");
    onChanged();
    onClosed();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Back" className="rounded p-1.5 hover:bg-surface-hover lg:hidden">
          <ArrowLeft className="size-5" />
        </button>
        {!inTrash && (
          <Button size="sm" variant="ghost" onClick={onReply}>
            <Reply className="size-4" /> Reply
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await api.updateMail(email.id, { is_starred: !email.is_starred });
            onChanged();
          }}
        >
          <Star className={clsx("size-4", email.is_starred && "fill-[#f5b400] text-[#f5b400]")} />
          {email.is_starred ? "Starred" : "Star"}
        </Button>
        <span className="flex-1" />
        {inTrash ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => act("restore")}>
              <RotateCcw className="size-4" /> Restore
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Delete forever
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => act("trash")}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
      </div>

      <article className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <h2 className="text-xl font-bold">{email.subject}</h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={email.from_name} color={colorForName(email.from_name)} />
          <div className="min-w-0 text-sm">
            <p>
              <b>{email.from_name}</b> <span className="text-ink-muted">&lt;{email.from_email}&gt;</span>
            </p>
            <p className="truncate text-xs text-ink-muted">To: {email.to_emails}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-ink-muted">
            {formatLongDate(email.sent_at)}, {formatTime(email.sent_at)}
          </span>
        </div>
        <div className="mt-6 text-sm leading-relaxed whitespace-pre-wrap">{email.body}</div>
      </article>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete forever?"
        message="This message will be permanently deleted."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await api.deleteMail(email.id);
          setConfirmDelete(false);
          toast("Message deleted");
          onChanged();
          onClosed();
        }}
      />
    </div>
  );
}
