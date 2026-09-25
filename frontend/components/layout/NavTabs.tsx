"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NavItem } from "./navItems";

function isActive(item: NavItem, pathname: string) {
  if (!item.href) return false;
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}

/**
 * Zoom Workplace's icon-over-label tabs: in the top bar on desktop ("top"),
 * and as a bottom tab bar on phones ("bottom"), like Zoom's mobile app.
 */
export function NavTabs({ placement = "top" }: { placement?: "top" | "bottom" }) {
  const pathname = usePathname();
  const items = placement === "bottom" ? NAV_ITEMS.filter((i) => !i.secondary) : NAV_ITEMS;

  return (
    <nav
      aria-label="Main"
      className={clsx("flex h-full items-stretch", placement === "bottom" && "w-full justify-around")}
    >
      {items.map((item) => {
        const active = isActive(item, pathname);
        const className = clsx(
          "group flex min-w-16 flex-col items-center justify-center gap-0.5 px-2 text-[11px] transition-colors",
          placement === "top" && item.secondary && "hidden xl:flex",
          active ? "text-zoom-blue" : "text-ink-muted hover:text-ink",
          !item.href && "cursor-default",
        );
        const content = (
          <>
            <span
              className={clsx(
                "flex h-7 w-10 items-center justify-center rounded-lg transition-colors",
                active ? "bg-zoom-blue-soft" : "group-hover:bg-surface-hover",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
            </span>
            <span className={clsx("leading-none", active && "font-bold")}>{item.label}</span>
          </>
        );

        return item.href ? (
          <Link key={item.label} href={item.href} className={className} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <button key={item.label} type="button" className={className} title={`${item.label} isn't part of this clone`}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
