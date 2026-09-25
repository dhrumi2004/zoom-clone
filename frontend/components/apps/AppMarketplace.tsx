"use client";

import clsx from "clsx";
import { Check, LayoutGrid, Search } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/workspace/PageShell";
import { api, ApiError, keys } from "@/lib/api";
import type { MarketplaceApp } from "@/lib/workspaceTypes";

type Tab = "discover" | "mine";

/** Zoom App Marketplace: browse by category, search, add or remove apps. */
export function AppMarketplace() {
  const toast = useToast();
  const { data: apps, mutate } = useSWR(keys.apps, api.getApps);
  const [tab, setTab] = useState<Tab>("discover");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const categories = ["All", ...new Set((apps ?? []).map((a) => a.category))];
  const q = query.trim().toLowerCase();
  const shown = (apps ?? []).filter(
    (a) =>
      (tab === "discover" || a.installed) &&
      (category === "All" || a.category === category) &&
      (a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)),
  );

  const toggle = async (app: MarketplaceApp) => {
    setBusy(app.key);
    try {
      const updated = app.installed ? await api.uninstallApp(app.key) : await api.installApp(app.key);
      await mutate(apps?.map((a) => (a.key === app.key ? updated : a)), { revalidate: false });
      toast(updated.installed ? `${app.name} added` : `${app.name} removed`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="Apps" subtitle="Add apps to use them in your meetings and chats." />

      <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-line">
        {(["discover", "mine"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "-mb-px border-b-2 pb-2.5 text-sm font-bold",
              tab === t ? "border-zoom-blue text-zoom-blue" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t === "discover" ? "Discover" : `My apps (${apps?.filter((a) => a.installed).length ?? 0})`}
          </button>
        ))}
        <label className="mb-2 ml-auto flex h-8 w-full items-center gap-2 rounded-lg border border-line px-2.5 text-sm sm:w-64">
          <Search className="size-4 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps"
            className="w-full bg-transparent outline-none focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-bold",
              category === c ? "border-zoom-blue bg-zoom-blue-soft text-zoom-blue" : "border-line text-ink-muted hover:bg-surface-hover",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {!apps && <div className="h-48 animate-pulse rounded-xl bg-surface-hover" />}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((app) => (
          <li key={app.key} className="flex flex-col rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white"
                style={{ backgroundColor: app.color }}
                aria-hidden
              >
                {app.name[0]}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">{app.name}</p>
                <p className="text-xs text-ink-muted">
                  {app.developer} · {app.category}
                </p>
              </div>
            </div>
            <p className="mt-3 flex-1 text-sm text-ink-muted">{app.description}</p>
            <Button
              size="sm"
              variant={app.installed ? "secondary" : "primary"}
              loading={busy === app.key}
              onClick={() => toggle(app)}
              className="mt-4 self-start"
            >
              {app.installed ? (
                <>
                  <Check className="size-4" /> Added · Remove
                </>
              ) : (
                "Add"
              )}
            </Button>
          </li>
        ))}
      </ul>
      {apps && !shown.length && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-ink-muted">
          <LayoutGrid className="size-10 text-ink-subtle" strokeWidth={1.25} />
          {tab === "mine" && !q ? "You haven't added any apps yet." : "No apps match your search."}
        </div>
      )}
    </div>
  );
}
