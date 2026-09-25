"use client";

import clsx from "clsx";
import { ArrowLeft, Mail, MapPin, MessageCircle, Phone, Search, Star, Users, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useState } from "react";
import useSWR from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FullHeight } from "@/components/workspace/PageShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStartMeeting } from "@/hooks/useStartMeeting";
import { api, ApiError, keys } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import type { Contact } from "@/lib/workspaceTypes";

type Tab = "all" | "favorites";

/** Zoom Contacts: directory list + profile card with Meet / Chat / Email. Selected contact lives in ?u=<id>. */
export function ContactsDirectory() {
  const router = useRouter();
  const selectedId = Number(useSearchParams().get("u")) || null;
  const { data: contacts, mutate } = useSWR(keys.contacts, api.getContacts);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = (contacts ?? []).filter(
    (c) =>
      (tab === "all" || c.is_favorite) &&
      [c.name, c.email, c.job_title, c.department].some((v) => v?.toLowerCase().includes(q)),
  );
  const selected = contacts?.find((c) => c.user_id === selectedId) ?? null;

  const toggleFavorite = async (c: Contact) => {
    // Update instantly, then confirm with the server
    await mutate(
      async (list) => {
        await api.setFavorite(c.user_id, !c.is_favorite);
        return list?.map((x) => (x.user_id === c.user_id ? { ...x, is_favorite: !c.is_favorite } : x));
      },
      {
        optimisticData: (list) => list?.map((x) => (x.user_id === c.user_id ? { ...x, is_favorite: !c.is_favorite } : x)) ?? [],
        revalidate: false,
      },
    );
  };

  return (
    <FullHeight>
      <aside className={clsx("flex w-full shrink-0 flex-col border-r border-line md:w-80", selected && "max-md:hidden")}>
        <div className="px-4 pt-4">
          <h1 className="text-lg font-bold">Contacts</h1>
          <div className="mt-3 flex gap-4 border-b border-line text-sm" role="tablist">
            {(["all", "favorites"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  "-mb-px border-b-2 pb-2 font-bold",
                  tab === t ? "border-zoom-blue text-zoom-blue" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {t === "all" ? "All contacts" : "Starred"}
              </button>
            ))}
          </div>
          <label className="my-3 flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-sm">
            <Search className="size-4 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or team"
              className="w-full bg-transparent outline-none focus-visible:outline-none"
            />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
          {shown.map((c) => (
            <li key={c.user_id}>
              <button
                type="button"
                onClick={() => router.replace(`/contacts?u=${c.user_id}`)}
                className={clsx(
                  "flex w-full items-center gap-3 px-4 py-2 text-left",
                  c.user_id === selectedId ? "bg-zoom-blue-soft" : "hover:bg-surface-muted",
                )}
              >
                <Avatar name={c.name} color={c.avatar_color} showStatus />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{c.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{c.job_title ?? c.email}</span>
                </span>
                {c.is_favorite && <Star className="size-4 fill-[#f5b400] text-[#f5b400]" aria-label="Starred" />}
              </button>
            </li>
          ))}
          {contacts && !shown.length && (
            <li className="px-4 py-10 text-center text-sm text-ink-muted">
              {tab === "favorites" && !q ? "Star a contact to see them here." : "No contacts found."}
            </li>
          )}
        </ul>
      </aside>

      <section className={clsx("min-w-0 flex-1 overflow-y-auto", !selected && "max-md:hidden")}>
        {selected ? (
          <ContactCard contact={selected} onBack={() => router.replace("/contacts")} onToggleFavorite={() => toggleFavorite(selected)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-muted">
            <Users className="size-12 text-ink-subtle" strokeWidth={1.25} />
            Select a contact to see their details.
          </div>
        )}
      </section>
    </FullHeight>
  );
}

function ContactCard({ contact, onBack, onToggleFavorite }: { contact: Contact; onBack: () => void; onToggleFavorite: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useCurrentUser();
  const { startInstant, creating } = useStartMeeting(user);

  const chat = async () => {
    try {
      const dm = await api.openDirect(contact.user_id);
      router.push(`/chat?c=${dm.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't open the chat.", "error");
    }
  };

  // Start a meeting and send them the link in a direct message.
  const meet = () =>
    startInstant(async (meeting) => {
      const dm = await api.openDirect(contact.user_id);
      await api.sendChannelMessage(dm.id, `📹 Join my Zoom meeting: ${meeting.invite_link}`);
    });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-ink-muted md:hidden">
        <ArrowLeft className="size-4" /> Contacts
      </button>
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar name={contact.name} color={contact.avatar_color} size="xl" showStatus />
        <div>
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold">
            {contact.name}
            <button type="button" onClick={onToggleFavorite} aria-label={contact.is_favorite ? "Unstar" : "Star"} className="rounded p-1 hover:bg-surface-hover">
              <Star className={clsx("size-5", contact.is_favorite ? "fill-[#f5b400] text-[#f5b400]" : "text-ink-subtle")} />
            </button>
          </h2>
          <p className="text-sm text-ink-muted">
            {[contact.job_title, contact.department].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-success">
            <span className="size-2 rounded-full bg-success" /> Available
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={() => meet()} loading={creating}>
            <Video className="size-4" /> Meet
          </Button>
          <Button variant="secondary" onClick={chat}>
            <MessageCircle className="size-4" /> Chat
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/mail?compose=${encodeURIComponent(contact.email)}`)}>
            <Mail className="size-4" /> Email
          </Button>
        </div>
      </div>

      <dl className="mt-8 divide-y divide-line rounded-xl border border-line">
        <Info icon={<Mail className="size-4" />} label="Email">
          {contact.email}
        </Info>
        {contact.phone && (
          <Info icon={<Phone className="size-4" />} label="Phone">
            {contact.phone}
          </Info>
        )}
        {contact.location && (
          <Info icon={<MapPin className="size-4" />} label="Location">
            {contact.location}
          </Info>
        )}
        <Info icon={<Video className="size-4" />} label="Personal Meeting ID">
          {formatMeetingCode(contact.personal_meeting_id)}
        </Info>
      </dl>
    </div>
  );
}

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="text-ink-muted">{icon}</span>
      <dt className="w-40 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{children}</dd>
    </div>
  );
}
