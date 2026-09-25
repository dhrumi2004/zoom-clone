"use client";

import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

interface DropdownMenuProps {
  /** Renders the trigger; call `toggle` on click */
  trigger: (props: { toggle: () => void; open: boolean }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
}

export function DropdownMenu({ trigger, items, align = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      {trigger({ toggle: () => setOpen((o) => !o), open })}
      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute top-full z-50 mt-1 min-w-44 rounded-lg border border-line bg-surface py-1 shadow-popover",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                item.onSelect();
              }}
              className={clsx(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-hover",
                item.danger ? "text-danger" : "text-ink",
              )}
            >
              {item.icon && <item.icon className="size-4" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
