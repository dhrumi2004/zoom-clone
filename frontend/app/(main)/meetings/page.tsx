import { Suspense } from "react";
import { MeetingsTabs } from "@/components/dashboard/MeetingsTabs";

export default function MeetingsPage() {
  // useSearchParams needs a Suspense boundary so the page can still be pre-rendered.
  return (
    <Suspense>
      <MeetingsTabs />
    </Suspense>
  );
}
