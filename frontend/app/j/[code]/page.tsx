import { InviteLanding } from "@/components/meetings/InviteLanding";

/** Invite link target: /j/{meeting code}?pwd={passcode} */
export default async function InvitePage({ params, searchParams }: PageProps<"/j/[code]">) {
  const { code } = await params;
  const { pwd } = await searchParams;
  return <InviteLanding code={code} passcode={typeof pwd === "string" ? pwd : undefined} />;
}
