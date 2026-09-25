"use client";

import { FileText } from "lucide-react";
import useSWR from "swr";
import { FileGrid } from "@/components/workspace/FileGrid";
import { api, keys } from "@/lib/api";

export default function DocsPage() {
  const { data, mutate } = useSWR(keys.docs, api.getDocs);
  return (
    <FileGrid
      title="Docs"
      newLabel="New doc"
      icon={FileText}
      accent="#0b5cff"
      basePath="/docs"
      items={data}
      onCreate={() => api.createDoc()}
      onDelete={async (id) => {
        await api.deleteDoc(id);
        await mutate();
      }}
    />
  );
}
