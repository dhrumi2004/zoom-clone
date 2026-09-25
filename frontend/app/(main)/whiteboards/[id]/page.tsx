"use client";

import { use } from "react";
import { WhiteboardPage } from "@/components/whiteboard/WhiteboardEditor";

export default function Page({ params }: PageProps<"/whiteboards/[id]">) {
  const { id } = use(params);
  return <WhiteboardPage id={Number(id)} />;
}
