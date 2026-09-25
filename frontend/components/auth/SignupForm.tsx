"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
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

/** Same rules as the backend (schemas/auth.py), shown live like Zoom's password checklist. */
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least one letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
];

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next_errors: Record<string, string> = {};
    if (!values.name.trim()) next_errors.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next_errors.email = "Please enter a valid email address.";
    if (!RULES.every((r) => r.test(values.password)))
      next_errors.password = "Your password doesn't meet the requirements.";
    if (values.confirm !== values.password) next_errors.confirm = "Passwords don't match.";
    setErrors(next_errors);
    if (Object.keys(next_errors).length) return;

    setLoading(true);
    try {
      const { token } = await api.signup(values.name, values.email, values.password);
      setToken(token);
      window.location.assign(next);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't create your account.";
      setErrors(err instanceof ApiError && err.code === "email_taken" ? { email: message } : { form: message });
      setLoading(false);
    }
  };

  return (
    <RedirectIfSignedIn to={next}>
      <AuthLayout
        switchText="Already have an account?"
        switchLabel="Sign In"
        switchHref={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
      >
        <h1 className="text-2xl font-bold">Create your free account</h1>
        <p className="mt-1 text-sm text-ink-muted">Meet, chat and collaborate with Zoom Workplace.</p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <TextInput
              id="name"
              autoComplete="name"
              autoFocus
              maxLength={100}
              value={values.name}
              onChange={set("name")}
              aria-invalid={!!errors.name}
            />
            <FieldError>{errors.name}</FieldError>
          </div>
          <div>
            <Label htmlFor="email">Email address</Label>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set("email")}
              aria-invalid={!!errors.email}
            />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              maxLength={128}
              value={values.password}
              onChange={set("password")}
              aria-invalid={!!errors.password}
            />
            <ul className="mt-2 space-y-1">
              {RULES.map((r) => {
                const met = r.test(values.password);
                return (
                  <li
                    key={r.label}
                    className={clsx("flex items-center gap-1.5 text-xs", met ? "text-success" : "text-ink-muted")}
                  >
                    <Check className={clsx("size-3.5", !met && "opacity-30")} /> {r.label}
                  </li>
                );
              })}
            </ul>
            <FieldError>{errors.password}</FieldError>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={values.confirm}
              onChange={set("confirm")}
              aria-invalid={!!errors.confirm}
            />
            <FieldError>{errors.confirm}</FieldError>
          </div>
          <FieldError>{errors.form}</FieldError>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Sign Up
          </Button>
          <p className="text-center text-xs text-ink-muted">
            By signing up, you agree to the Terms of Service and Privacy Statement.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-bold text-zoom-blue hover:underline"
          >
            Sign in
          </Link>
        </p>
      </AuthLayout>
    </RedirectIfSignedIn>
  );
}
