import { COURT_PATHS } from "../lib/court";

/** Half-court lines in the 500 × 420 frame. Draw before the marks. */
export function CourtLines() {
  return (
    <g fill="none" stroke="#b9ab94" strokeWidth={2} pointerEvents="none">
      <path d={COURT_PATHS.three} />
      <rect x={170} y={0} width={160} height={190} />
      <circle cx={250} cy={190} r={60} />
      <path d={COURT_PATHS.restricted} />
      <line x1={220} y1={40} x2={280} y2={40} />
      <circle cx={250} cy={52.5} r={7.5} />
    </g>
  );
}
