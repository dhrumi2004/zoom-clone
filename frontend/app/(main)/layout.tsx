import { RequireAuth } from "@/components/auth/RequireAuth";
import { NavTabs } from "@/components/layout/NavTabs";
import { TopNav } from "@/components/layout/TopNav";

/** Every signed-in page except the meeting room shares the Zoom Workplace top bar. */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <div className="flex h-full flex-col">
        <TopNav />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <div className="h-16 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          <NavTabs placement="bottom" />
        </div>
      </div>
    </RequireAuth>
  );
}
