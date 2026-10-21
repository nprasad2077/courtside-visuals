export interface LabelCandidate {
  id: string;
  text: string;
  /** Anchor point in SVG units (the dot's centre). */
  x: number;
  y: number;
  /** Dot radius, so the label starts just past the dot's edge. */
  r: number;
}

export interface PlacedLabel extends LabelCandidate {
  /** Top-left of the label box, in SVG units. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export const LABEL_H = 14;
export const labelWidth = (text: string) => text.length * 6.2 + 4;

const overlaps = (a: PlacedLabel, b: PlacedLabel) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

/**
 * Greedy label placement for the usage × efficiency scatter (1c).
 * `candidates` arrive in priority order (selected player first, then stars by BPM).
 * Places at most `max` labels; a label whose box hits an already-placed box is skipped.
 */
export function placeLabels(candidates: LabelCandidate[], max: number, bounds: { w: number; h: number }): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const c of candidates) {
    if (placed.length >= max) break;
    const width = labelWidth(c.text);
    // Default slot: right of the dot, vertically centred on it.
    const box: PlacedLabel = { ...c, left: c.x + c.r + 4, top: c.y - LABEL_H / 2, width, height: LABEL_H };

    // TODO(you): try a second slot before giving up on a label.
    // When the right-hand slot collides (or runs off bounds.w), a left-hand slot
    // (left = c.x - c.r - 4 - width) often fits, which labels more stars in dense
    // clusters. The trade-off: alternating sides makes it harder to tell which
    // dot a name belongs to. Decide whether to add the fallback, and whether the
    // selected player (index 0) should be allowed to skip collision checks entirely.
    if (box.left + box.width > bounds.w) box.left = c.x - c.r - 4 - width;

    if (placed.some((p) => overlaps(p, box))) continue;
    placed.push(box);
  }
  return placed;
}
