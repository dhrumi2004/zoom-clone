"use client";

import { ShieldCheck } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { MeetingClient } from "@/lib/meeting/client";
import type { SecurityState } from "@/lib/meeting/types";

/** Zoom's Security button (hosts and co-hosts): lock the meeting and control what participants can do. */
export function SecurityMenu({ security, client }: { security: SecurityState | null; client: MeetingClient }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!security) return null;
  const s = security.settings;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Security"
        aria-expanded={open}
        className="relative flex h-[56px] min-w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 text-[11px] text-white/90 hover:bg-white/10 sm:min-w-[72px] sm:px-2 sm:text-xs"
      >
        <ShieldCheck className="size-[22px]" />
        <span className="hidden whitespace-nowrap sm:inline">Security</span>
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-1/2 z-40 w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-[#2a2a2a] p-2 text-sm text-white shadow-popover">
          <Row label="Lock meeting" checked={security.locked} onChange={(v) => client.updateSecurity({ locked: v })} />
          <Row label="Enable waiting room" checked={s.waiting_room} onChange={(v) => client.updateSecurity({ waiting_room: v })} />
          <p className="px-3 pt-2 pb-1 text-xs text-white/50">Allow all participants to:</p>
          <Row label="Share screen" checked={s.allow_screen_share} onChange={(v) => client.updateSecurity({ allow_screen_share: v })} />
          <Row label="Chat" checked={s.allow_chat} onChange={(v) => client.updateSecurity({ allow_chat: v })} />
          <Row label="Rename themselves" checked={s.allow_rename} onChange={(v) => client.updateSecurity({ allow_rename: v })} />
          <Row label="Unmute themselves" checked={s.allow_unmute} onChange={(v) => client.updateSecurity({ allow_unmute: v })} />
        </div>
      )}
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-white/10">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-zoom-blue" />
    </label>
  );
}
