import { describe, expect, it } from "vitest";
import { fold, highlight } from "./search";

describe("search", () => {
  it("folds accents and keeps an index map", () => {
    expect(fold("Jokić")).toEqual({ text: "jokic", map: [0, 1, 2, 3, 4] });
  });
  it("highlights the original accented slice", () => {
    expect(highlight("Nikola Jokić", "jokic")).toEqual(["Nikola ", "Jokić", ""]);
    expect(highlight("Luka Dončić", "DONC")).toEqual(["Luka ", "Donč", "ić"]);
    expect(highlight("Luka Dončić", "zz")).toBeNull();
  });
});
