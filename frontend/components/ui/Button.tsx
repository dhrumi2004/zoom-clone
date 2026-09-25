import clsx from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

const VARIANTS = {
  primary: "bg-zoom-blue text-white hover:bg-zoom-blue-hover disabled:bg-zoom-blue/40",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-hover disabled:text-ink-subtle",
  soft: "bg-surface-muted text-ink hover:bg-surface-hover disabled:text-ink-subtle",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
  ghost: "text-zoom-blue hover:bg-zoom-blue-soft disabled:text-ink-subtle",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
});
