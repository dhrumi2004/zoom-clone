import { LucideIcon } from "lucide-react";

/** Centered empty state for pages that exist only for navigation parity with Zoom. */
export function Placeholder({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-zoom-blue-soft text-zoom-blue">
        <Icon className="size-8" />
      </span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-ink-muted">{text}</p>
    </div>
  );
}
