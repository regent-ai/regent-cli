import { afterEach, describe, expect, it } from "vitest";

import { captureOutput } from "../../../test-support/test-helpers.js";

import { printError, printJson, renderUsageScreen } from "../src/printer.js";

const originalNoColor = process.env.NO_COLOR;
const originalIsTTY = process.stdout.isTTY;

const setStdoutTty = (value: boolean): void => {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value,
  });
};

afterEach(() => {
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }

  setStdoutTty(Boolean(originalIsTTY));
});

describe("printer surface", () => {
  it("renders a framed usage screen", () => {
    const output = renderUsageScreen("/tmp/regent.json");

    expect(output).toContain("R E G E N T   C L I");
    expect(output).toContain("Start Here");
    expect(output).toContain("Techtree Next Commands");
    expect(output).toContain("BBH Next Loop");
    expect(output).toContain("Guided start first");
    expect(output).toContain("use regents.sh/services for guided setup, billing, claimed names, and company launch");
    expect(output).toContain("use regent techtree start first for most Techtree setups");
    expect(output).toContain("it checks local config, the runtime, identity, Techtree readiness, and BBH readiness");
    expect(output).toContain("when that finishes, move into the next Techtree task or the BBH branch you need");
    expect(output).toContain("regent techtree start");
    expect(output).toContain("regent techtree node lineage list <id>");
    expect(output).toContain("regent techtree node cross-chain-links create <id> --input @file.json");
    expect(output).toContain("regent techtree node lineage withdraw <id> --claim-id <claim-id>");
    expect(output).toContain("regent techtree node cross-chain-links clear <id>");
    expect(output).toContain("regent techtree node create ... [--cross-chain-link @file.json] [--paid-payload @file.json]");
    expect(output).toContain("regent techtree comment add --node-id <id> --body-markdown ...");
    expect(output).toContain("regent techtree autoskill notebook pair [path]");
    expect(output).toContain("regent techtree autoskill buy <node-id>");
    expect(output).toContain("regent chatbox tail --webapp|--agent");
    expect(output).toContain("regent autolaunch trust x-link --agent <id>");
    expect(output).toContain("regent bug --summary");
    expect(output).toContain("regent security-report --summary");
    expect(output).toContain("regent xmtp group permissions <conversation-id>");
    expect(output).toContain("regent xmtp group update-permission <conversation-id> --type add-member --policy admin");
    expect(output).toContain("regent xmtp group add-admin <conversation-id> --address <wallet>");
    expect(output).toContain("regent techtree bbh capsules list [--lane climb|benchmark|challenge]");
    expect(output).toContain("regent techtree bbh capsules get <capsule-id>");
    expect(output).toContain("regent techtree bbh run exec [path] --capsule <capsule-id> [--lane climb|benchmark|challenge]");
    expect(output).toContain("regent techtree bbh notebook pair [path]");
    expect(output).toContain("regent techtree bbh run solve [path] --solver hermes|openclaw|skydiscover");
    expect(output).toContain("BBH after setup");
    expect(output).toContain("run exec creates the BBH run folder");
    expect(output).toContain("SkyDiscover adds the search pass inside the run folder");
    expect(output).toContain("Hypotest scores the run and checks replay during validation");
    expect(output).toContain("regent techtree bbh genome init [path] [--lane climb|benchmark|challenge] [--sample-size 3] [--budget 6]");
    expect(output).toContain("regent techtree bbh genome improve [path]");
  });

  it("renders framed JSON output for human terminals", async () => {
    setStdoutTty(true);
    delete process.env.NO_COLOR;

    const output = await captureOutput(async () => {
      printJson({
        data: {
          lane: "benchmark",
          entries: [],
        },
      });
    });

    expect(output.stdout).toContain("REGENT DATA DECK");
    expect(output.stdout).toContain("lane");
    expect(output.stdout).toContain("benchmark");
    expect(output.stdout).toContain("╭");
  });

  it("renders a framed error for human terminals", async () => {
    setStdoutTty(true);
    delete process.env.NO_COLOR;

    const output = await captureOutput(async () => {
      printError(new Error("operator shell failed"));
    });

    expect(output.stderr).toContain("REGENT ERROR");
    expect(output.stderr).toContain("operator shell failed");
    expect(output.stderr).toContain("╭");
  });
});
