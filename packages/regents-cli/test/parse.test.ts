import { describe, expect, it } from "vitest";

import { getFlag, getFlags, parseCliArgs, parseIntegerFlag } from "../src/parse.js";

describe("CLI parsing", () => {
  it("keeps empty positional arguments instead of dropping them", () => {
    const parsed = parseCliArgs(["alpha", "", "--flag", "value", "--", "", "omega"]);

    expect(parsed.positionals).toEqual(["alpha", "", "", "omega"]);
    expect(getFlag(parsed, "flag")).toBe("value");
  });

  it("rejects malformed integer flags", () => {
    expect(() => parseIntegerFlag(["--limit", "12abc"], "limit")).toThrow("invalid integer for --limit");
    expect(() => parseIntegerFlag(["--limit", "001"], "limit")).toThrow("invalid integer for --limit");
  });

  it("keeps repeated long flags in order", () => {
    const parsed = parseCliArgs(["work", "--tag", "one", "--tag=two", "--tag", "three"]);

    expect(getFlag(parsed, "tag")).toBe("three");
    expect(getFlags(parsed, "tag")).toEqual(["one", "two", "three"]);
  });
});
