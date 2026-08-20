"use client";

import { SEGMENTS, type SegmentId } from "@/lib/segments";

interface Props {
  active: SegmentId | "all";
  onChange: (segment: SegmentId | "all") => void;
  counts: Record<string, number>;
  totalCount: number;
}

export default function SegmentTabs({ active, onChange, counts, totalCount }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <TabButton
        label="All segments"
        color="#111827"
        count={totalCount}
        selected={active === "all"}
        onClick={() => onChange("all")}
      />
      {SEGMENTS.map((s) => (
        <TabButton
          key={s.id}
          label={s.shortLabel}
          color={s.color}
          count={counts[s.id] ?? 0}
          selected={active === s.id}
          onClick={() => onChange(s.id)}
        />
      ))}
    </div>
  );
}

function TabButton({
  label,
  color,
  count,
  selected,
  onClick,
}: {
  label: string;
  color: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? "border-transparent text-white shadow-sm"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
      style={selected ? { backgroundColor: color } : undefined}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.8)" : color }}
      />
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
          selected ? "bg-white/20" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
