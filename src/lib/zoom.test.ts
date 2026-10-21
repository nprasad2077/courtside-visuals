import { describe, expect, it } from "vitest";
import { clampDomain, nearest, panBy, quantile, zoomAround } from "./zoom";

describe("zoom", () => {
  it("keeps the value under the cursor fixed", () => {
    const d = zoomAround([0, 100], 25, 0.5, [0, 100], 1);
    expect(d).toEqual([12.5, 62.5]);
  });
  it("stops at min span and at the bounds", () => {
    expect(zoomAround([40, 60], 50, 0.01, [0, 100], 10)).toEqual([45, 55]);
    expect(zoomAround([10, 90], 50, 4, [0, 100], 1)).toEqual([0, 100]);
  });
  it("pans without leaving the bounds", () => {
    expect(panBy([10, 30], -50, [0, 100])).toEqual([0, 20]);
    expect(panBy([70, 90], 30, [0, 100])).toEqual([80, 100]);
  });
  it("clamps an oversized domain to the bounds", () => {
    expect(clampDomain([-20, 200], [0, 100])).toEqual([0, 100]);
  });
  it("finds the nearest point within range", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 12, y: 9 },
    ];
    expect(nearest(pts, 11, 9, 5)).toBe(2);
    expect(nearest(pts, 50, 50, 5)).toBe(-1);
  });
  it("interpolates quantiles", () => {
    expect(quantile([4, 1, 3, 2, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });
});
