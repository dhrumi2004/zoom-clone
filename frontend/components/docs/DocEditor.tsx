"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  LucideIcon,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { SaveStatus, useAutosave } from "@/hooks/useAutosave";
import { api, keys } from "@/lib/api";
import type { Doc } from "@/lib/workspaceTypes";

export function DocEditorPage({ id }: { id: number }) {
  const { data: doc, error } = useSWR(["doc", id], () => api.getDoc(id), { revalidateOnFocus: false });
  if (error) return <NotFound />;
  if (!doc) return <div className="mx-auto mt-10 h-96 max-w-3xl animate-pulse rounded-xl bg-surface-hover" />;
  return <Editor key={doc.id} doc={doc} />;
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="font-bold">This document doesn&apos;t exist anymore.</p>
      <Link href="/docs" className="text-sm font-bold text-zoom-blue hover:underline">
        Back to Docs
      </Link>
    </div>
  );
}

// Formatting buttons. document.execCommand is old but still supported by every browser for contentEditable.
const TOOLS: { icon: LucideIcon; label: string; command: string; arg?: string; state?: string }[] = [
  { icon: Undo2, label: "Undo", command: "undo" },
  { icon: Redo2, label: "Redo", command: "redo" },
  { icon: Heading1, label: "Heading 1", command: "formatBlock", arg: "h1" },
  { icon: Heading2, label: "Heading 2", command: "formatBlock", arg: "h2" },
  { icon: Bold, label: "Bold", command: "bold", state: "bold" },
  { icon: Italic, label: "Italic", command: "italic", state: "italic" },
  { icon: Underline, label: "Underline", command: "underline", state: "underline" },
  { icon: Strikethrough, label: "Strikethrough", command: "strikeThrough", state: "strikeThrough" },
  { icon: List, label: "Bulleted list", command: "insertUnorderedList", state: "insertUnorderedList" },
  { icon: ListOrdered, label: "Numbered list", command: "insertOrderedList", state: "insertOrderedList" },
  { icon: Quote, label: "Quote", command: "formatBlock", arg: "blockquote" },
];

function Editor({ doc }: { doc: Doc }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(doc.title);
  const [active, setActive] = useState<Set<string>>(new Set());
  const { state, schedule } = useAutosave((changes: { title: string; content: string }) =>
    api.updateDoc(doc.id, changes).then(() => mutate(keys.docs)),
  );

  // Load the (server-sanitized) content once; after that the browser owns the editable DOM.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = doc.content;
  }, [doc.content]);

  const save = useCallback(
    (nextTitle = title) => schedule({ title: nextTitle.trim() || "Untitled document", content: editorRef.current?.innerHTML ?? "" }),
    [schedule, title],
  );

  // Highlight toolbar buttons for the formatting at the cursor.
  useEffect(() => {
    const update = () => {
      if (!editorRef.current?.contains(document.getSelection()?.anchorNode ?? null)) return;
      setActive(new Set(TOOLS.filter((t) => t.state && document.queryCommandState(t.state)).map((t) => t.state!)));
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const run = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    save();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2">
        <Link href="/docs" aria-label="Back to Docs" className="rounded-lg p-1.5 hover:bg-surface-hover">
          <ArrowLeft className="size-5" />
        </Link>
        <input
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            save(e.target.value);
          }}
          aria-label="Document title"
          className="min-w-0 flex-1 rounded px-1 text-lg font-bold outline-none hover:bg-surface-muted focus:bg-surface-muted focus-visible:outline-none"
        />
        <SaveStatus state={state} />
      </header>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-4 py-1.5" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={t.state ? active.has(t.state) : undefined}
            // Keep the text selection when clicking a toolbar button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.command, t.arg)}
            className={clsx(
              "rounded-md p-1.5 hover:bg-surface-hover",
              t.state && active.has(t.state) ? "bg-zoom-blue-soft text-zoom-blue" : "text-ink-muted",
            )}
          >
            <t.icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted px-4 py-8">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Document content"
          data-placeholder="Start typing…"
          onInput={() => save()}
          className="doc-content mx-auto min-h-[70vh] max-w-3xl rounded-lg bg-surface px-8 py-10 shadow-sm outline-none focus-visible:outline-none sm:px-14"
        />
      </div>
    </div>
  );
}
