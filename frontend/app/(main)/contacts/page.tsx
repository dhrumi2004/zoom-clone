import { Suspense } from "react";
import { ContactsDirectory } from "@/components/contacts/ContactsDirectory";

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsDirectory />
    </Suspense>
  );
}
