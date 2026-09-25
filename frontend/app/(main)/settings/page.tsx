import { Suspense } from "react";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function Settings() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
