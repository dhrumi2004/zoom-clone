"use client";

import { Ellipsis, LucideIcon, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { formatRelativeDay, formatTime } from "@/lib/format";
import { PageHeader } from "./PageShell";

interface Item {
  id: number;
  title: string;
  updated_at: string;
}

interface Props<T extends Item> {
  title: string;
  newLabel: string;
  icon: LucideIcon;
  accent: string;
  basePath: string; // "/docs" or "/whiteboards"
  items: T[] | undefined;
  onCreate: () => Promise<{ id: number }>;
  onDelete: (id: number) => Promise<void>;
}

/** The list page shared by Docs and Whiteboards: header with "New", cards, delete from the "…" menu. */
export function FileGrid<T extends Item>({ title, newLabel, icon: Icon, accent, basePath, items, onCreate, onDelete }: Props<T>) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const created = await onCreate();
      router.push(`${basePath}/${created.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't create it.", "error");
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={title}
        actions={
          <Button onClick={create} loading={creating}>
            <Plus className="size-4" /> {newLabel}
          </Button>
        }
      />
      {!items && <div className="h-40 animate-pulse rounded-xl bg-surface-hover" />}
      {items && !items.length && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
          <Icon className="size-10 text-ink-subtle" strokeWidth={1.25} />
          <p className="text-sm text-ink-muted">Nothing here yet.</p>
          <Button onClick={create}>{newLabel}</Button>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((item) => (
          <li key={item.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface hover:shadow-popover">
            <Link href={`${basePath}/${item.id}`} className="block">
              <div className="flex h-28 items-center justify-center" style={{ backgroundColor: `${accent}14` }}>
                <Icon className="size-10" style={{ color: accent }} strokeWidth={1.5} />
              </div>
              <div className="p-4 pr-12">
                <p className="truncate font-bold">{item.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Edited {formatRelativeDay(item.updated_at)}, {formatTime(item.updated_at)}
                </p>
              </div>
            </Link>
            <div className="absolute right-2 bottom-3">
              <DropdownMenu
                items={[{ label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(item) }]}
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} aria-label={`More options for ${item.title}`} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-hover">
                    <Ellipsis className="size-5" />
                  </button>
                )}
              />
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete?"
        message={`"${deleting?.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await onDelete(deleting.id);
          toast("Deleted");
          setDeleting(null);
        }}
      />
    </div>
  );
}
