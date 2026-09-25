import Link from "next/link";
import { ReactNode } from "react";
import { ZoomLogo } from "@/components/layout/ZoomLogo";

/** Zoom's sign-in / sign-up page frame: logo top-left, a switch link top-right, a centered card. */
export function AuthLayout({ children, switchText, switchLabel, switchHref }: {
  children: ReactNode;
  switchText: string;
  switchLabel: string;
  switchHref: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-surface-muted">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <Link href="/login" aria-label="Zoom Workplace">
          <ZoomLogo />
        </Link>
        <p className="text-sm text-ink-muted">
          <span className="hidden sm:inline">{switchText} </span>
          <Link href={switchHref} className="font-bold text-zoom-blue hover:underline">
            {switchLabel}
          </Link>
        </p>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-[420px] rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
