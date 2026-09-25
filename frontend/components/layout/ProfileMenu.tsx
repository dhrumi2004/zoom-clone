"use client";

import { ChevronRight, CircleHelp, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { formatMeetingCode } from "@/lib/format";

/** Avatar button + dropdown card (name, email, status, settings, sign out). */
export function ProfileMenu() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const signOut = async () => {
    await api.logout().catch(() => {}); // ends the session on the server
    clearToken();
    // A full reload (not router.push) on purpose: it clears everything cached for this account.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  };

  if (!user) return <span className="size-9 animate-pulse rounded-[10px] bg-surface-hover" />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile"
        className="rounded-xl p-0.5 hover:bg-surface-hover"
      >
        <Avatar name={user.name} color={user.avatar_color} showStatus />
      </button>

      {open && (
        <div role="menu" className="absolute top-12 right-0 z-50 w-72 rounded-xl border border-line bg-surface py-2 shadow-popover">
          <div className="flex items-center gap-3 px-4 pt-2 pb-3">
            <Avatar name={user.name} color={user.avatar_color} size="lg" showStatus />
            <div className="min-w-0">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <span className="mt-1 inline-block rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-muted">
                BASIC
              </span>
            </div>
          </div>

          <MenuDivider />
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-success" /> Available
            </span>
            <ChevronRight className="size-4 text-ink-subtle" />
          </div>
          <div className="px-4 pb-2 text-xs text-ink-muted">
            Personal Meeting ID: <span className="text-ink">{formatMeetingCode(user.personal_meeting_id)}</span>
          </div>

          <MenuDivider />
          <Link href="/settings?tab=profile" onClick={close} role="menuitem">
            <MenuItem icon={UserRound} label="My profile" />
          </Link>
          <Link href="/settings" onClick={close} role="menuitem">
            <MenuItem icon={Settings} label="Settings" />
          </Link>
          <MenuItem icon={CircleHelp} label="Help" />

          <MenuDivider />
          <button type="button" role="menuitem" onClick={signOut} className="block w-full text-left">
            <MenuItem icon={LogOut} label="Sign out" />
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, muted }: { icon: typeof Settings; label: string; muted?: boolean }) {
  return (
    <span
      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-surface-hover ${muted ? "text-ink-muted" : ""}`}
    >
      <Icon className="size-4 text-ink-muted" />
      {label}
    </span>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-line" />;
}
