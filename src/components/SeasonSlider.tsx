import { seasonLabel } from "../lib/format";

interface Props {
  value: number | undefined;
  onChange: (s: number) => void;
  /** Seasons available; gaps snap to the nearest one. */
  seasons: number[];
  label?: string;
}

export function SeasonSlider({ value, onChange, seasons, label = "Season" }: Props) {
  const min = seasons[0] ?? 2000;
  const max = seasons[seasons.length - 1] ?? 2025;
  const pick = (raw: number) => {
    const best = seasons.reduce((b, s) => (Math.abs(s - raw) < Math.abs(b - raw) ? s : b), seasons[0] ?? raw);
    if (best !== value) onChange(best);
  };
  return (
    <div className="season">
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value ?? max}
        disabled={seasons.length < 2}
        aria-label={label}
        aria-valuetext={value != null ? seasonLabel(value) : undefined}
        onChange={(e) => pick(Number(e.target.value))}
      />
      <span className="season-label">{value != null ? seasonLabel(value) : "—"}</span>
    </div>
  );
}

export const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
