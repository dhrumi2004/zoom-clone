import clsx from "clsx";
import { ReactNode } from "react";

/** Full-height area for app-like pages (Team Chat, Mail): the page itself never scrolls, its panes do. */
export function FullHeight({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex h-full min-h-0", className)}>{children}</div>;
}

/** Standard page header used by Docs, Whiteboards, Contacts, Apps, Settings. */
export function PageHeader({ title, actions, subtitle }: { title: string; actions?: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** "Today" / "Yesterday" / "Mon, Sep 22" divider for message lists. */
export function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3 text-[11px] font-bold text-ink-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
