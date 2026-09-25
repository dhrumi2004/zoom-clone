import { Suspense } from "react";
import { MailApp } from "@/components/mail/MailApp";

export default function MailPage() {
  return (
    <Suspense>
      <MailApp />
    </Suspense>
  );
}
