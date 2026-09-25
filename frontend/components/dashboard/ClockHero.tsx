"use client";

import { useNow } from "@/hooks/useNow";
import { formatLongDate, formatTime } from "@/lib/format";

/** Big local time + date over a scenic gradient, at the top of Zoom's home calendar card. */
export function ClockHero() {
  const now = useNow();

  return (
    <div className="relative h-36 overflow-hidden rounded-t-xl bg-[linear-gradient(135deg,#1f3b73_0%,#2f5fb3_45%,#6b9be0_100%)] px-6 py-6 text-white sm:h-40">
      {/* soft "hills" to echo Zoom's landscape artwork */}
      <span className="absolute -right-10 -bottom-24 size-72 rounded-full bg-white/10" />
      <span className="absolute -bottom-32 left-10 size-80 rounded-full bg-white/5" />
      <div className="relative">
        <p className="text-5xl font-bold tracking-tight tabular-nums sm:text-[56px]" suppressHydrationWarning>
          {now ? formatTime(now) : " "}
        </p>
        <p className="mt-1 text-sm text-white/90">{now ? formatLongDate(now) : " "}</p>
      </div>
    </div>
  );
}
