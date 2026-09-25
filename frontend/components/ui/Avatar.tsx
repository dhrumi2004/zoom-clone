import clsx from "clsx";
import { initials } from "@/lib/format";

const SIZES = {
  sm: "size-7 text-[11px] rounded-lg",
  md: "size-9 text-xs rounded-[10px]",
  lg: "size-14 text-lg rounded-2xl",
  xl: "size-24 text-3xl rounded-3xl",
} as const;

interface AvatarProps {
  name: string;
  color: string;
  size?: keyof typeof SIZES;
  /** Green "Available" dot, as on Zoom's profile picture */
  showStatus?: boolean;
  className?: string;
}

/** Zoom-style rounded-square avatar with initials. */
export function Avatar({ name, color, size = "md", showStatus = false, className }: AvatarProps) {
  return (
    <span className={clsx("relative inline-flex shrink-0", className)}>
      <span
        className={clsx("flex items-center justify-center font-bold text-white select-none", SIZES[size])}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {showStatus && (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-success" />
      )}
    </span>
  );
}
