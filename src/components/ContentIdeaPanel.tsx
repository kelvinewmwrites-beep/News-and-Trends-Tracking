"use client";

import { useState } from "react";
import type { ContentIdea } from "@/lib/types";
import type { SegmentId } from "@/lib/segments";

interface Props {
  segment: SegmentId | "all";
  ideas: ContentIdea[];
  onGenerate: (segment: SegmentId) => Promise<void>;
  generating: boolean;
  generatorUsed: "claude" | "template" | null;
  availableSegments: { id: SegmentId; label: string }[];
}

export default function ContentIdeaPanel({
  segment,
  ideas,
  onGenerate,
  generating,
  generatorUsed,
  availableSegments,
}: Props) {
  const [targetSegment, setTargetSegment] = useState<SegmentId>(
    segment === "all" ? availableSegments[0]?.id : segment
  );

  const effectiveTarget = segment === "all" ? targetSegment : segment;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Content ideas
        </h2>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {segment === "all" && (
          <select
            value={targetSegment}
            onChange={(e) => setTargetSegment(e.target.value as SegmentId)}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            {availableSegments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => onGenerate(effectiveTarget)}
          disabled={generating}
          className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {generating ? "Generating…" : "Generate new ideas"}
        </button>
      </div>

      {generatorUsed && (
        <p className="mt-1.5 text-[11px] text-zinc-400">
          {generatorUsed === "claude"
            ? "Generated with Claude from recent tracked news."
            : "Generated with built-in templates (set ANTHROPIC_API_KEY for AI-written ideas)."}
        </p>
      )}

      {ideas.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">
          No ideas yet for this view. Generate some from the latest tracked news.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </ul>
      )}
    </div>
  );
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [copied, setCopied] = useState(false);

  const copyText = `${idea.title}\n\nFormat: ${idea.format}\nAngle: ${idea.angle}\nHook: ${idea.hook}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  return (
    <li className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100">
          {idea.title}
        </p>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {idea.format}
      </span>
      <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-500 dark:text-zinc-300">Angle: </span>
        {idea.angle}
      </p>
      <p className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">
        &ldquo;{idea.hook}&rdquo;
      </p>
    </li>
  );
}
