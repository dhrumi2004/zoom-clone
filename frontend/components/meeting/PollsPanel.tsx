"use client";

import clsx from "clsx";
import { BarChart3, Plus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextInput } from "@/components/ui/Field";
import type { MeetingClient } from "@/lib/meeting/client";
import type { Poll } from "@/lib/meeting/types";

/** Zoom Polls: hosts/co-hosts create and launch polls and see live results; participants vote. */
export function PollsPanel({ polls, client, isModerator }: { polls: Poll[]; client: MeetingClient; isModerator: boolean }) {
  const [creating, setCreating] = useState(false);
  const newestFirst = [...polls].reverse();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {isModerator && !creating && (
          <Button className="w-full" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create a poll
          </Button>
        )}
        {creating && <PollForm onCancel={() => setCreating(false)} onLaunch={(q, o, a) => (client.createPoll(q, o, a), setCreating(false))} />}
        {newestFirst.map((poll) => (
          <PollCard key={poll.id} poll={poll} client={client} isModerator={isModerator} />
        ))}
        {!polls.length && !creating && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ink-muted">
            <BarChart3 className="size-10 text-ink-subtle" strokeWidth={1.25} />
            {isModerator ? "Create a poll to get quick feedback from everyone." : "The host hasn't started a poll yet."}
          </div>
        )}
      </div>
    </div>
  );
}

function PollForm({ onCancel, onLaunch }: { onCancel: () => void; onLaunch: (q: string, options: string[], anonymous: boolean) => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [anonymous, setAnonymous] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && filled.length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onLaunch(question.trim(), filled, anonymous);
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-line p-3">
      <TextInput aria-label="Poll question" placeholder="Ask a question" value={question} maxLength={300} onChange={(e) => setQuestion(e.target.value)} />
      {options.map((value, i) => (
        <div key={i} className="flex items-center gap-1">
          <TextInput
            aria-label={`Answer ${i + 1}`}
            placeholder={`Answer ${i + 1}`}
            value={value}
            maxLength={200}
            onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {options.length > 2 && (
            <button type="button" aria-label="Remove answer" onClick={() => setOptions((o) => o.filter((_, j) => j !== i))} className="rounded p-1 text-ink-muted hover:bg-surface-hover">
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {options.length < 10 && (
        <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="text-xs font-bold text-zoom-blue hover:underline">
          + Add answer
        </button>
      )}
      <Checkbox checked={anonymous} onChange={setAnonymous} label="Anonymous" hint="Hide who voted for what" />
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="soft" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!valid}>
          Launch
        </Button>
      </div>
    </form>
  );
}

function PollCard({ poll, client, isModerator }: { poll: Poll; client: MeetingClient; isModerator: boolean }) {
  const [choice, setChoice] = useState<number | null>(poll.my_vote);
  const open = poll.status === "open";
  const showResults = poll.options.some((o) => o.votes !== undefined);
  const total = poll.total_votes ?? 0;

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{poll.question}</p>
        <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", open ? "bg-success/15 text-success" : "bg-surface-hover text-ink-muted")}>
          {open ? "Live" : "Ended"}
        </span>
      </div>

      {open && !isModerator ? (
        <div className="space-y-1.5">
          {poll.options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted">
              <input type="radio" name={`poll-${poll.id}`} checked={choice === o.id} onChange={() => setChoice(o.id)} className="accent-zoom-blue" />
              {o.text}
            </label>
          ))}
          <Button size="sm" className="mt-1 w-full" disabled={choice === null || choice === poll.my_vote} onClick={() => choice && client.vote(poll.id, choice)}>
            {poll.my_vote ? "Change answer" : "Submit"}
          </Button>
          {poll.my_vote && <p className="text-center text-xs text-success">Your answer was submitted</p>}
        </div>
      ) : showResults ? (
        <div className="space-y-2">
          {poll.options.map((o) => {
            const pct = total ? Math.round(((o.votes ?? 0) / total) * 100) : 0;
            return (
              <div key={o.id} title={o.voters?.join(", ")}>
                <div className="flex justify-between text-xs">
                  <span className={clsx(poll.my_vote === o.id && "font-bold")}>{o.text}</span>
                  <span className="text-ink-muted">
                    {pct}% ({o.votes ?? 0})
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-hover">
                  <div className="h-full rounded-full bg-zoom-blue transition-all" style={{ width: `${pct}%` }} />
                </div>
                {isModerator && !!o.voters?.length && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{o.voters.join(", ")}</p>}
              </div>
            );
          })}
          <p className="text-xs text-ink-muted">
            {total} {total === 1 ? "vote" : "votes"}
            {poll.anonymous && " · anonymous"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Poll ended. The host may share the results.</p>
      )}

      {isModerator && (
        <div className="mt-3 flex gap-2">
          {open ? (
            <Button size="sm" variant="secondary" onClick={() => client.endPoll(poll.id)}>
              End poll
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => client.sharePollResults(poll.id, !poll.results_shared)}>
              {poll.results_shared ? "Stop sharing results" : "Share results"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
