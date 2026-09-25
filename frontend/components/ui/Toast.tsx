"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error";
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

/** Small dark pill at the bottom of the screen ("Invitation copied", errors). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-popover"
        >
          {toast.kind === "success" ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <CircleAlert className="size-4 text-danger" />
          )}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
