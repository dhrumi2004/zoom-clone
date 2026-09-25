import { Suspense } from "react";
import { TeamChat } from "@/components/chat/TeamChat";

export default function ChatPage() {
  return (
    <Suspense>
      <TeamChat />
    </Suspense>
  );
}
