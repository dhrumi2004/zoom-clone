"use client";

import { use } from "react";
import { DocEditorPage } from "@/components/docs/DocEditor";

export default function DocPage({ params }: PageProps<"/docs/[id]">) {
  const { id } = use(params);
  return <DocEditorPage id={Number(id)} />;
}
