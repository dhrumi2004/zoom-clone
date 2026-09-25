import { RequireAuth } from "@/components/auth/RequireAuth";
import { InviteLanding } from "@/components/meetings/InviteLanding";

/** Invite link target: /j/{meeting code}?pwd={passcode}. Signed-out visitors sign in first, then return here. */
export default async function InvitePage({ params, searchParams }: PageProps<"/j/[code]">) {
  const { code } = await params;
  const { pwd } = await searchParams;
  return (
    <RequireAuth>
      <InviteLanding code={code} passcode={typeof pwd === "string" ? pwd : undefined} />
    </RequireAuth>
  );
}
