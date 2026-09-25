import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ListStateProps {
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyAction?: ReactNode;
}

/** Shared loading skeleton / error / empty view for the meeting lists. */
export function ListState({ loading, error, onRetry, emptyIcon: Icon, emptyTitle, emptyAction }: ListStateProps) {
  if (loading) {
    return (
      <div className="space-y-3 p-5" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-hover" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-surface-hover" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm">
        <p className="text-ink-muted">{error.message}</p>
        <button type="button" onClick={onRetry} className="font-bold text-zoom-blue hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <Icon className="size-10 text-ink-subtle" strokeWidth={1.25} />
      <p className="text-sm text-ink-muted">{emptyTitle}</p>
      {emptyAction}
    </div>
  );
}
