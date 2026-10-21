import { describe, expect, it } from "vitest";
import { assignSeeds, last10, streak } from "./standings.ts";
import { franchiseOf, teamInfo } from "./teams.ts";

describe("standings", () => {
  it("counts wins in the last ten only", () => {
    expect(last10([..."WWWWW", ..."LLLLLLLLLL"])).toBe(0);
    expect(last10([..."LLWWWWWWWWW"])).toBe(9);
    expect(last10([..."WL"])).toBe(1);
  });

  it("reports the current streak", () => {
    expect(streak([..."WWLLL"])).toBe("L3");
    expect(streak([..."LW"])).toBe("W1");
    expect(streak([])).toBe("—");
  });

  it("seeds within each conference by wins, then net rating", () => {
    const rows = assignSeeds([
      { team: "A", conf: "E" as const, w: 50, net: 2 } as { team: string; conf: "E" | "W"; w: number; net: number; seed?: number },
      { team: "B", conf: "E" as const, w: 50, net: 5 },
      { team: "C", conf: "W" as const, w: 40, net: 0 },
      { team: "D", conf: "E" as const, w: 60, net: -1 },
    ]);
    const seed = Object.fromEntries(rows.map((r) => [r.team, r.seed]));
    expect(seed).toEqual({ D: 1, B: 2, A: 3, C: 1 });
  });
});

describe("teams", () => {
  it("folds relocated codes into the current franchise", () => {
    expect(franchiseOf("SEA")).toBe("OKC");
    expect(franchiseOf("NJN")).toBe("BRK");
    expect(franchiseOf("BKN")).toBe("BRK");
    expect(franchiseOf("GSW")).toBe("GSW");
  });

  it("keeps historical names and conferences", () => {
    expect(teamInfo("SEA", 2005).name).toMatch(/SuperSonics/);
    expect(teamInfo("NOH", 2002).conf).toBe("E");
    expect(teamInfo("NOP", 2020).conf).toBe("W");
  });
});
