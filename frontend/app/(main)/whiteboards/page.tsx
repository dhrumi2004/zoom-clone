"use client";

import { PenLine } from "lucide-react";
import useSWR from "swr";
import { FileGrid } from "@/components/workspace/FileGrid";
import { api, keys } from "@/lib/api";

export default function WhiteboardsPage() {
  const { data, mutate } = useSWR(keys.whiteboards, api.getWhiteboards);
  return (
    <FileGrid
      title="Whiteboards"
      newLabel="New whiteboard"
      icon={PenLine}
      accent="#ff742e"
      basePath="/whiteboards"
      items={data}
      onCreate={() => api.createWhiteboard()}
      onDelete={async (id) => {
        await api.deleteWhiteboard(id);
        await mutate();
      }}
    />
  );
}
