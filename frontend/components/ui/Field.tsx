/** Form building blocks styled like Zoom's inputs. */
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle hover:border-ink-subtle focus:border-zoom-blue focus:ring-1 focus:ring-zoom-blue disabled:bg-surface-muted aria-invalid:border-danger aria-invalid:ring-danger";

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={clsx("mb-1.5 block text-[13px] font-bold text-ink", className)}>
      {children}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(inputBase, "h-10", className)} {...props} />;
});

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputBase, "min-h-20 resize-y py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={clsx("relative block", className)}>
      <select className={clsx(inputBase, "h-10 appearance-none pr-8")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted" />
    </span>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}

/** Zoom's square blue checkbox with the label on the right. */
export function Checkbox({ checked, onChange, label, hint, disabled }: CheckboxProps) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-2.5 text-sm", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={clsx(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-zoom-blue/40",
          checked ? "border-zoom-blue bg-zoom-blue text-white" : "border-ink-subtle bg-surface",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3.5} />}
      </span>
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

interface RadioGroupProps<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function RadioGroup<T extends string>({ name, value, onChange, options }: RadioGroupProps<T>) {
  return (
    <span className="flex gap-5">
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="size-4 accent-zoom-blue"
          />
          {o.label}
        </label>
      ))}
    </span>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-danger">
      {children}
    </p>
  );
}

/** iOS/Zoom-style on/off switch with a label on the left. */
export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 py-3">
      <span className="text-sm">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={clsx(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-zoom-blue/40",
          checked ? "bg-zoom-blue" : "bg-ink-subtle/50",
          "after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform",
          checked && "after:translate-x-4",
        )}
      />
    </label>
  );
}
