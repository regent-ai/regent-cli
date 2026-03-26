import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOutput, parsePrintedJson } from "../helpers/output.js";

const { daemonCallMock } = vi.hoisted(() => ({
  daemonCallMock: vi.fn(),
}));

vi.mock("../../src/daemon-client.js", () => ({
  daemonCall: daemonCallMock,
}));

describe("BBH draft command group", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a draft from a workspace and forwards title, seed, and parent id", async () => {
    daemonCallMock.mockResolvedValue({
      data: {
        capsule: {
          capsule_id: "capsule_draft_test",
          title: "Capsule draft",
        },
      },
    });

    const { runTechtreeBbhDraftCreate } = await import("../../src/commands/techtree-v1-bbh-draft.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeBbhDraftCreate(
        parseCliArgs([
          "techtree",
          "bbh",
          "draft",
          "create",
          "draft-workspace",
          "--title",
          "Capsule draft",
          "--seed",
          "BBH",
          "--parent-id",
          "42",
        ]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.bbh.draft.create",
      {
        workspace_path: expect.stringMatching(/draft-workspace$/),
        title: "Capsule draft",
        seed: "BBH",
        parent_id: 42,
      },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: {
        capsule: {
          capsule_id: "capsule_draft_test",
          title: "Capsule draft",
        },
      },
    });
  });

  it("submits a draft proposal with the selected capsule id and summary", async () => {
    daemonCallMock.mockResolvedValue({
      data: {
        proposal: {
          proposal_id: "proposal_test",
          capsule_id: "capsule_draft_test",
        },
      },
    });

    const { runTechtreeBbhDraftPropose } = await import("../../src/commands/techtree-v1-bbh-draft.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeBbhDraftPropose(
        parseCliArgs([
          "techtree",
          "bbh",
          "draft",
          "propose",
          "draft-workspace",
          "--capsule-id",
          "capsule_draft_test",
          "--summary",
          "tightened rubric",
        ]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.bbh.draft.propose",
      {
        workspace_path: expect.stringMatching(/draft-workspace$/),
        capsule_id: "capsule_draft_test",
        summary: "tightened rubric",
      },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: {
        proposal: {
          proposal_id: "proposal_test",
          capsule_id: "capsule_draft_test",
        },
      },
    });
  });
});
