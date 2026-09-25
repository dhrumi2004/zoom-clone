"use client";

import clsx from "clsx";
import { ArrowLeft, Download, Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SaveStatus, useAutosave } from "@/hooks/useAutosave";
import { api, keys } from "@/lib/api";
import type { Stroke, Whiteboard } from "@/lib/workspaceTypes";

/** Drawings are stored in a fixed logical size and scaled to fit the screen, so they look the same everywhere. */
const BOARD_W = 1600;
const BOARD_H = 1000;
const COLORS = ["#232333", "#0b5cff", "#e02828", "#00a93f", "#ff742e", "#8b5cf6", "#eab308", "#ec4899"];
const SIZES = [2, 4, 8, 14];

export function WhiteboardPage({ id }: { id: number }) {
  const { data: board, error } = useSWR(["whiteboard", id], () => api.getWhiteboard(id), { revalidateOnFocus: false });
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="font-bold">This whiteboard doesn&apos;t exist anymore.</p>
        <Link href="/whiteboards" className="text-sm font-bold text-zoom-blue hover:underline">
          Back to Whiteboards
        </Link>
      </div>
    );
  }
  if (!board) return <div className="m-6 h-[70vh] animate-pulse rounded-xl bg-surface-hover" />;
  return <Editor key={board.id} board={board} />;
}

function parseStrokes(data: string): Stroke[] {
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The eraser "draws transparency", so the dotted background shows through again.
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  ctx.globalAlpha = s.tool === "highlighter" ? 0.35 : 1;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.tool === "highlighter" ? s.size * 3 : s.tool === "eraser" ? s.size * 4 : s.size;
  ctx.beginPath();
  const [first, ...rest] = s.points;
  ctx.moveTo(first[0], first[1]);
  if (!rest.length) ctx.lineTo(first[0] + 0.1, first[1]); // a single click still leaves a dot
  for (const [x, y] of rest) ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function Editor({ board }: { board: Whiteboard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(parseStrokes(board.data));
  const redoStack = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<Stroke["tool"]>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [title, setTitle] = useState(board.title);
  // How many steps Undo / Redo can take (state, so the buttons enable/disable correctly)
  const [history, setHistory] = useState(() => ({ undo: parseStrokes(board.data).length, redo: 0 }));
  const [confirmClear, setConfirmClear] = useState(false);

  const { state, schedule } = useAutosave((changes: { title?: string; data?: string }) =>
    api.updateWhiteboard(board.id, changes).then(() => mutate(keys.whiteboards)),
  );

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    strokes.current.forEach((s) => drawStroke(ctx, s));
  }, []);

  useEffect(redraw, [redraw]);

  const commit = () => {
    setHistory({ undo: strokes.current.length, redo: redoStack.current.length });
    schedule({ title, data: JSON.stringify(strokes.current) });
  };

  // Screen pixels -> board coordinates
  const toBoard = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(((e.clientX - rect.left) / rect.width) * BOARD_W),
      Math.round(((e.clientY - rect.top) / rect.height) * BOARD_H),
    ];
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { tool, color, size, points: [toBoard(e)] };
    redoStack.current = [];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, drawing.current);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const stroke = drawing.current;
    if (!stroke) return;
    stroke.points.push(toBoard(e));
    // Redraw everything so highlighter/eraser blend correctly (fast enough for whiteboard sizes).
    redraw();
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, stroke);
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    strokes.current.push(drawing.current);
    drawing.current = null;
    redraw();
    commit();
  };

  const undo = () => {
    const last = strokes.current.pop();
    if (last) redoStack.current.push(last);
    redraw();
    commit();
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (next) strokes.current.push(next);
    redraw();
    commit();
  };

  const download = () => {
    // Export on white (the canvas itself is transparent over the dotted background)
    const out = document.createElement("canvas");
    out.width = BOARD_W;
    out.height = BOARD_H;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.drawImage(canvasRef.current!, 0, 0);
    const link = document.createElement("a");
    link.download = `${title || "whiteboard"}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };

  const toolButton = (value: Stroke["tool"], Icon: typeof Pen, label: string) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={tool === value}
      onClick={() => setTool(value)}
      className={clsx("rounded-lg p-2", tool === value ? "bg-zoom-blue-soft text-zoom-blue" : "text-ink-muted hover:bg-surface-hover")}
    >
      <Icon className="size-5" />
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2">
        <Link href="/whiteboards" aria-label="Back to Whiteboards" className="rounded-lg p-1.5 hover:bg-surface-hover">
          <ArrowLeft className="size-5" />
        </Link>
        <input
          value={title}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule({ title: e.target.value.trim() || "Untitled whiteboard", data: JSON.stringify(strokes.current) });
          }}
          aria-label="Whiteboard title"
          className="min-w-0 flex-1 rounded px-1 text-lg font-bold outline-none hover:bg-surface-muted focus:bg-surface-muted focus-visible:outline-none"
        />
        <SaveStatus state={state} />
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-line px-4 py-1.5" role="toolbar" aria-label="Drawing tools">
        {toolButton("pen", Pen, "Pen")}
        {toolButton("highlighter", Highlighter, "Highlighter")}
        {toolButton("eraser", Eraser, "Eraser")}
        <span className="mx-2 h-6 w-px bg-line" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            onClick={() => {
              setColor(c);
              if (tool === "eraser") setTool("pen");
            }}
            className={clsx("size-6 rounded-full border-2", color === c ? "border-zoom-blue ring-2 ring-zoom-blue/30" : "border-white shadow")}
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="mx-2 h-6 w-px bg-line" />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Size ${s}`}
            aria-pressed={size === s}
            onClick={() => setSize(s)}
            className={clsx("flex size-8 items-center justify-center rounded-lg", size === s ? "bg-zoom-blue-soft" : "hover:bg-surface-hover")}
          >
            <span className="rounded-full bg-ink" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" title="Undo" aria-label="Undo" onClick={undo} disabled={!history.undo} className="rounded-lg p-2 text-ink-muted hover:bg-surface-hover disabled:opacity-40">
          <Undo2 className="size-5" />
        </button>
        <button type="button" title="Redo" aria-label="Redo" onClick={redo} disabled={!history.redo} className="rounded-lg p-2 text-ink-muted hover:bg-surface-hover disabled:opacity-40">
          <Redo2 className="size-5" />
        </button>
        <button type="button" title="Clear board" aria-label="Clear board" onClick={() => setConfirmClear(true)} className="rounded-lg p-2 text-ink-muted hover:bg-surface-hover">
          <Trash2 className="size-5" />
        </button>
        <button type="button" title="Download PNG" aria-label="Download PNG" onClick={download} className="rounded-lg p-2 text-ink-muted hover:bg-surface-hover">
          <Download className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-hover p-4">
        <canvas
          ref={canvasRef}
          width={BOARD_W}
          height={BOARD_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Whiteboard canvas"
          className={clsx(
            "aspect-[16/10] max-h-full w-full max-w-full touch-none rounded-lg bg-white shadow-sm",
            "bg-[radial-gradient(#d4d4dc_1px,transparent_1px)] [background-size:24px_24px]",
            tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
          )}
          style={{ maxWidth: `calc((100vh - 220px) * ${BOARD_W / BOARD_H})` }}
        />
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear whiteboard?"
        message="Everything on this board will be erased."
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          strokes.current = [];
          redoStack.current = [];
          redraw();
          commit();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
