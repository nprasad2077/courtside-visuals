import { describe, expect, it } from "vitest";
import { COLD, diverging, HOT, isDark, PAR } from "./color";

describe("diverging", () => {
  it("hits the three stops and clamps past the span", () => {
    expect(diverging(0, 0.1)).toBe(PAR);
    expect(diverging(0.1, 0.1)).toBe(HOT);
    expect(diverging(-0.5, 0.1)).toBe(COLD);
  });
  it("is halfway at half the span", () => expect(diverging(0.05, 0.1)).toBe("#cb9d7a"));
  it("isDark picks text color", () => {
    expect(isDark("#2e2b25")).toBe(true);
    expect(isDark("#fbf7f0")).toBe(false);
  });
});
