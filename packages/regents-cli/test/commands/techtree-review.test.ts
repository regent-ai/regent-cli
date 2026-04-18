import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOutput, parsePrintedJson } from "../helpers/output.js";

const { daemonCallMock } = vi.hoisted(() => ({
  daemonCallMock: vi.fn(),
}));

vi.mock("../../src/daemon-client.js", () => ({
  daemonCall: daemonCallMock,
}));

describe("review command group", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists certification reviews", async () => {
    daemonCallMock.mockResolvedValue({
      data: [{ request_id: "review_req_test", review_kind: "certification" }],
    });

    const { runTechtreeReviewList } = await import("../../src/commands/techtree-v1-review.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeReviewList(
        parseCliArgs(["techtree", "review", "list", "--kind", "certification"]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.review.list",
      { kind: "certification" },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: [{ request_id: "review_req_test", review_kind: "certification" }],
    });
  });

  it("pulls and submits a review workspace", async () => {
    daemonCallMock
      .mockResolvedValueOnce({
        ok: true,
        entrypoint: "bbh.review.pull",
        workspace_path: "/tmp/review-workspace",
        request_id: "review_req_test",
        capsule_id: "capsule_draft_test",
        files: ["review.request.json", "genome-recommendation.source.json", "review.checklist.json"],
      })
      .mockResolvedValueOnce({
        data: {
          submission: {
            submission_id: "review_sub_test",
            request_id: "review_req_test",
          },
        },
      });

    const { runTechtreeReviewPull, runTechtreeReviewSubmit } = await import("../../src/commands/techtree-v1-review.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const pullOutput = await captureOutput(() =>
      runTechtreeReviewPull(
        parseCliArgs(["techtree", "review", "pull", "review_req_test", "review-workspace"]),
      ),
    );
    const submitOutput = await captureOutput(() =>
      runTechtreeReviewSubmit(
        parseCliArgs(["techtree", "review", "submit", "review-workspace"]),
      ),
    );

    expect(parsePrintedJson(pullOutput.stdout)).toEqual({
      ok: true,
      entrypoint: "bbh.review.pull",
      workspace_path: "/tmp/review-workspace",
      request_id: "review_req_test",
      capsule_id: "capsule_draft_test",
      files: ["review.request.json", "genome-recommendation.source.json", "review.checklist.json"],
    });
    expect(parsePrintedJson(submitOutput.stdout)).toEqual({
      data: {
        submission: {
          submission_id: "review_sub_test",
          request_id: "review_req_test",
        },
      },
    });
    expect(daemonCallMock).toHaveBeenNthCalledWith(
      1,
      "techtree.v1.review.pull",
      {
        request_id: "review_req_test",
        workspace_path: expect.stringMatching(/review-workspace$/),
      },
      undefined,
    );
    expect(daemonCallMock).toHaveBeenNthCalledWith(
      2,
      "techtree.v1.review.submit",
      {
        workspace_path: expect.stringMatching(/review-workspace$/),
      },
      undefined,
    );
  });
});
