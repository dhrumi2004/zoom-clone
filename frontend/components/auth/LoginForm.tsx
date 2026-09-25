"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, Label, TextInput } from "@/components/ui/Field";
import { api, ApiError } from "@/lib/api";
import { safeNext, setToken } from "@/lib/auth";
import { AuthLayout } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";
import { RedirectIfSignedIn } from "./RequireAuth";

// Seeded accounts (see backend/app/seed.py) so reviewers can try the app, including multi-user meetings.
const DEMO_PASSWORD = "zoom1234";
const DEMO_ACCOUNTS = [
  { name: "Dhrumi Upadhyay", email: "dhrumi@zoomclone.dev", note: "has sample meetings" },
  { name: "Aarav Shah", email: "aarav@zoomclone.dev", note: "second user" },
  { name: "Priya Patel", email: "priya@zoomclone.dev", note: "third user" },
];

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const joining = next.startsWith("/j/") || next.startsWith("/meeting/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (e: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await api.login(e, p);
      setToken(token);
      // Full page load so no data from a previous account stays in memory
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Please try again.");
      setLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Please enter your email and password.");
    void signIn(email, password);
  };

  return (
    <RedirectIfSignedIn to={next}>
      <AuthLayout
        switchText="New to Zoom?"
        switchLabel="Sign Up Free"
        switchHref={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
      >
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {joining
            ? "Sign in to join the meeting."
            : params.get("expired")
              ? "Your session has ended. Please sign in again."
              : "Welcome back to Zoom Workplace."}
        </p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email address</Label>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          New to Zoom?{" "}
          <Link
            href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-bold text-zoom-blue hover:underline"
          >
            Sign up free
          </Link>
        </p>

        <div className="mt-6 rounded-xl bg-surface-muted p-4">
          <p className="text-xs font-bold text-ink">Try a demo account</p>
          <p className="mb-2 text-xs text-ink-muted">Password for all: {DEMO_PASSWORD}</p>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={loading}
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                  void signIn(a.email, DEMO_PASSWORD);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
              >
                <span>
                  <b>{a.name}</b> <span className="text-xs text-ink-muted">({a.note})</span>
                </span>
                <span className="text-xs text-zoom-blue">Sign in</span>
              </button>
            ))}
          </div>
        </div>
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
