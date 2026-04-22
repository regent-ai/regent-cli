import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOutput, parsePrintedJson } from "../helpers/output.js";

const { daemonCallMock } = vi.hoisted(() => ({
  daemonCallMock: vi.fn(),
}));

vi.mock("../../src/daemon-client.js", () => ({
  daemonCall: daemonCallMock,
}));

describe("techtree v1 command runners", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("forwards workspace commands through the shared tree runner", async () => {
    daemonCallMock.mockResolvedValue({
      ok: true,
      tree: "main",
      entrypoint: "artifact.compile",
    });

    const { runTechtreeArtifactCompile } = await import("../../src/commands/techtree-v1.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeArtifactCompile(
        "main",
        parseCliArgs(["techtree", "main", "artifact", "compile", "artifact-workspace"]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.artifact.compile",
      {
        tree: "main",
        workspace_path: expect.stringMatching(/artifact-workspace$/),
      },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      ok: true,
      tree: "main",
      entrypoint: "artifact.compile",
    });
  });

  it("adds required init and metadata fields through the shared builders", async () => {
    daemonCallMock.mockResolvedValueOnce({
      ok: true,
      tree: "main",
      entrypoint: "run.init",
    });
    daemonCallMock.mockResolvedValueOnce({
      ok: true,
      tree: "main",
      entrypoint: "run.exec",
    });

    const { runTechtreeRunInit, runTechtreeRunExec } = await import("../../src/commands/techtree-v1.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    await captureOutput(() =>
      runTechtreeRunInit(
        "main",
        parseCliArgs([
          "techtree",
          "main",
          "run",
          "init",
          "--artifact",
          "0x1234000000000000000000000000000000000000000000000000000000000000",
          "run-workspace",
        ]),
      ),
    );

    const execOutput = await captureOutput(() =>
      runTechtreeRunExec(
        "main",
        parseCliArgs([
          "techtree",
          "main",
          "run",
          "exec",
          "run-workspace",
          "--executor-harness-kind",
          "hermes",
          "--executor-harness-profile",
          "researcher",
          "--origin-kind",
          "api",
          "--origin-session-id",
          "session-123",
        ]),
      ),
    );

    expect(daemonCallMock).toHaveBeenNthCalledWith(
      1,
      "techtree.v1.run.init",
      {
        tree: "main",
        workspace_path: expect.stringMatching(/run-workspace$/),
        artifact_id: "0x1234000000000000000000000000000000000000000000000000000000000000",
      },
      undefined,
    );
    expect(daemonCallMock).toHaveBeenNthCalledWith(
      2,
      "techtree.v1.run.exec",
      {
        tree: "main",
        workspace_path: expect.stringMatching(/run-workspace$/),
        metadata: {
          executor_harness: {
            kind: "hermes",
            profile: "researcher",
          },
          origin: {
            kind: "api",
            session_id: "session-123",
          },
        },
      },
      undefined,
    );
    expect(parsePrintedJson(execOutput.stdout)).toEqual({
      ok: true,
      tree: "main",
      entrypoint: "run.exec",
    });
  });
});
