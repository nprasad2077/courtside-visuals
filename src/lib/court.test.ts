import { describe, expect, it } from "vitest";
import { zoneKey } from "./court";

describe("zoneKey", () => {
  it("rim", () => expect(zoneKey(250, 60).key).toBe("0C"));
  it("corners are threes on each side", () => {
    expect(zoneKey(15, 40)).toMatchObject({ key: "4Lc", zi: 4, corner: true });
    expect(zoneKey(485, 40)).toMatchObject({ key: "4Rc", corner: true });
  });
  it("wings split left and right of the hoop", () => {
    expect(zoneKey(80, 250).key).toBe("4L");
    expect(zoneKey(420, 250).key).toBe("4R");
  });
  it("straightaway long two vs deep three", () => {
    expect(zoneKey(250, 260).key).toBe("3C");
    expect(zoneKey(250, 360).key).toBe("5C");
  });
});
