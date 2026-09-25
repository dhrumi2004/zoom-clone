import { Search, Settings } from "lucide-react";
import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { ProfileMenu } from "./ProfileMenu";
import { ZoomLogo } from "./ZoomLogo";

/** Zoom Workplace top bar: logo + search | tabs | settings + profile. */
export function TopNav() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link href="/" aria-label="Zoom Workplace home" className="shrink-0">
          <ZoomLogo />
        </Link>
        <label className="hidden h-8 w-full max-w-60 items-center gap-2 rounded-lg bg-surface-muted px-3 text-sm text-ink-subtle focus-within:ring-2 focus-within:ring-zoom-blue lg:flex">
          <Search className="size-4 shrink-0" />
          <input placeholder="Search" className="w-full bg-transparent text-ink outline-none placeholder:text-ink-subtle" />
          <kbd className="shrink-0 font-sans text-[11px]">⌘F</kbd>
        </label>
      </div>

      {/* On phones the tabs move to the bottom bar (see MainLayout) */}
      <div className="hidden h-full shrink-0 md:block">
        <NavTabs />
      </div>

      <div className="flex flex-1 items-center justify-end gap-1">
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
        >
          <Settings className="size-5" strokeWidth={1.75} />
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}
