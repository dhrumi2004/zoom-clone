"use client";

import clsx from "clsx";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useBadges } from "@/hooks/useBadges";
import { useClickOutside } from "@/hooks/useClickOutside";
import { isActive, NAV_ITEMS, NavItem } from "./navItems";

type Placement = "top" | "bottom";

/**
 * Zoom Workplace's icon-over-label tabs: in the top bar on desktop ("top"),
 * and as a bottom tab bar on phones ("bottom"), like Zoom's mobile app.
 * Secondary tabs collapse into "More" when there isn't room (below xl on top, always on the bottom bar).
 */
export function NavTabs({ placement = "top" }: { placement?: Placement }) {
  const pathname = usePathname();
  const badges = useBadges();
  const primary = NAV_ITEMS.filter((i) => !i.secondary);
  const secondary = NAV_ITEMS.filter((i) => i.secondary);
  const shown = placement === "top" ? NAV_ITEMS : primary;
  const count = (item: NavItem) => (item.badge && badges ? badges[item.badge] : 0);

  return (
    <nav aria-label="Main" className={clsx("flex h-full items-stretch", placement === "bottom" && "w-full justify-around")}>
      {shown.map((item) => (
        <Tab
          key={item.href}
          item={item}
          active={isActive(item, pathname)}
          badge={count(item)}
          className={placement === "top" && item.secondary ? "hidden xl:flex" : undefined}
        />
      ))}
      <MoreMenu
        items={secondary}
        pathname={pathname}
        count={count}
        placement={placement}
        className={placement === "top" ? "xl:hidden" : undefined}
      />
    </nav>
  );
}

function TabContent({ icon: Icon, label, active, badge }: { icon: NavItem["icon"]; label: string; active: boolean; badge: number }) {
  return (
    <>
      <span
        className={clsx(
          "relative flex h-7 w-10 items-center justify-center rounded-lg transition-colors",
          active ? "bg-zoom-blue-soft" : "group-hover:bg-surface-hover",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
        {badge > 0 && (
          <span className="absolute -top-1 right-0 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={clsx("leading-none whitespace-nowrap", active && "font-bold")}>{label}</span>
    </>
  );
}

const tabClass = (active: boolean) =>
  clsx(
    "group flex min-w-16 flex-col items-center justify-center gap-0.5 px-2 text-[11px] transition-colors",
    active ? "text-zoom-blue" : "text-ink-muted hover:text-ink",
  );

function Tab({ item, active, badge, className }: { item: NavItem; active: boolean; badge: number; className?: string }) {
  return (
    <Link href={item.href} className={clsx(tabClass(active), className)} aria-current={active ? "page" : undefined}>
      <TabContent icon={item.icon} label={item.label} active={active} badge={badge} />
    </Link>
  );
}

function MoreMenu({
  items,
  pathname,
  count,
  placement,
  className,
}: {
  items: NavItem[];
  pathname: string;
  count: (item: NavItem) => number;
  placement: Placement;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const active = items.some((i) => isActive(i, pathname));
  const badge = items.reduce((sum, i) => sum + count(i), 0);

  return (
    <div ref={ref} className={clsx("relative flex", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={tabClass(active)}>
        <TabContent icon={Ellipsis} label="More" active={active} badge={badge} />
      </button>
      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute right-0 z-50 w-48 rounded-xl border border-line bg-surface py-1 shadow-popover",
            placement === "top" ? "top-full mt-1" : "bottom-full mb-2",
          )}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={close}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-hover",
                isActive(item, pathname) ? "font-bold text-zoom-blue" : "text-ink",
              )}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {count(item) > 0 && (
                <span className="rounded-full bg-danger px-1.5 text-[10px] leading-4 font-bold text-white">{count(item)}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
