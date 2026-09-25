/** Text wordmark in Zoom's style ("zoom" + "Workplace"). Drawn with type, not the real trademarked logo. */
export function ZoomLogo() {
  return (
    <span className="flex items-baseline gap-1.5 leading-none select-none">
      <span className="text-[22px] font-black tracking-tight text-zoom-blue">zoom</span>
      <span className="hidden text-sm font-bold text-ink sm:inline">Workplace</span>
    </span>
  );
}
