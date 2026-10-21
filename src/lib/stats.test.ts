import { describe, expect, it } from "vitest";
import { percentile, rolling, spreadLabels } from "./stats";

describe("stats", () => {
  it("rolling uses what's available early", () => expect(rolling([2, 4, 6, 8], 3)).toEqual([2, 3, 4, 6]));
  it("percentile runs 0 to 1", () => {
    expect(percentile(1, [1, 2, 3])).toBe(0);
    expect(percentile(3, [1, 2, 3])).toBe(1);
  });
  it("spreadLabels keeps the gap and the input order", () => {
    const out = spreadLabels([50, 10, 52], 10);
    expect(out[1]).toBe(10);
    expect(Math.abs(out[2] - out[0])).toBeGreaterThanOrEqual(10);
  });
  it("spreadLabels respects the bottom bound", () => {
    const out = spreadLabels([98, 99, 100], 10, 0, 100);
    expect(Math.max(...out)).toBe(100);
    expect(Math.min(...out)).toBe(80);
  });
});
