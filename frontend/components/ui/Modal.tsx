"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Centered dialog with overlay, closes on Escape or overlay click (Zoom's white rounded dialogs). */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Focus the first input (or the panel) so keyboard users land inside the dialog.
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]");
    (first ?? panelRef.current)?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={clsx("flex max-h-full w-full max-w-md flex-col rounded-xl bg-surface shadow-popover outline-none", className)}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
