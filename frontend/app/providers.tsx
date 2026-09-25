"use client";

import { ReactNode } from "react";
import { SWRConfig } from "swr";
import { ToastProvider } from "@/components/ui/Toast";

/** Client-side context shared by every page. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ shouldRetryOnError: false }}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
