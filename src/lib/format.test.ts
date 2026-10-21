import { describe, expect, it } from "vitest";
import { clock, lastName, num, pct, seasonLabel, signed, winPct } from "./format";

describe("format", () => {
  it("pct drops the % sign", () => expect(pct(0.6123)).toBe("61.2"));
  it("signed uses U+2212 for negatives", () => {
    expect(signed(3.24)).toBe("+3.2");
    expect(signed(-1)).toBe("−1.0");
    expect(signed(-0.01)).toBe("0.0");
  });
  it("num and missing values", () => {
    expect(num(-2.25, 1)).toBe("−2.3");
    expect(pct(null)).toBe("—");
  });
  it("winPct has no leading zero", () => {
    expect(winPct(60, 82)).toBe(".732");
    expect(winPct(0, 0)).toBe(".000");
  });
  it("seasonLabel uses an en dash and wraps the century", () => {
    expect(seasonLabel(2016)).toBe("2016–17");
    expect(seasonLabel(1999)).toBe("1999–00");
  });
  it("lastName skips suffixes", () => expect(lastName("Jaren Jackson Jr.")).toBe("Jackson"));
  it("clock", () => expect(clock(252)).toBe("4:12"));
});
