"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { loginUrl, useAuthToken } from "@/lib/auth";

/** Shows its children only when signed in; otherwise sends you to Sign In and brings you back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthToken();
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace(loginUrl());
  }, [token, router]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center" aria-busy>
        <span className="size-8 animate-spin rounded-full border-4 border-line border-t-zoom-blue" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Sign In / Sign Up pages: if you're already signed in, go straight to the app. */
export function RedirectIfSignedIn({ children, to }: { children: ReactNode; to: string }) {
  const token = useAuthToken();
  const router = useRouter();
  useEffect(() => {
    if (token) router.replace(to);
  }, [token, router, to]);
  return token ? null : <>{children}</>;
}
