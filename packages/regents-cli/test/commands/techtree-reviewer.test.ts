import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOutput, parsePrintedJson } from "../helpers/output.js";

const { daemonCallMock, execFileMock } = vi.hoisted(() => ({
  daemonCallMock: vi.fn(),
  execFileMock: vi.fn((file: string, args: string[], callback?: (error: Error | null, stdout?: string, stderr?: string) => void) => {
    callback?.(null, "", "");
    return {} as any;
  }),
}));

vi.mock("../../src/daemon-client.js", () => ({
  daemonCall: daemonCallMock,
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

describe("reviewer command group", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    execFileMock.mockImplementation((file: string, args: string[], callback?: (error: Error | null, stdout?: string, stderr?: string) => void) => {
      callback?.(null, "", "");
      return {} as any;
    });
  });

  it("starts ORCID linking, opens the browser, and polls until authenticated", async () => {
    daemonCallMock
      .mockResolvedValueOnce({
        data: {
          request_id: "orcid_req_test",
          state: "pending",
          start_url: "https://example.com/orcid/start",
        },
      })
      .mockResolvedValueOnce({
        data: {
          request_id: "orcid_req_test",
          state: "authenticated",
          reviewer: {
            wallet_address: "0x1111111111111111111111111111111111111111",
            orcid_id: "0000-0000-0000-0001",
            vetting_status: "pending",
            domain_tags: ["scrna-seq"],
          },
        },
      });

    const { runTechtreeReviewerOrcidLink } = await import("../../src/commands/techtree-v1-reviewer.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeReviewerOrcidLink(
        parseCliArgs([
          "techtree",
          "reviewer",
          "orcid",
          "link",
          "--poll-interval-ms",
          "1",
          "--timeout-ms",
          "10",
        ]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(daemonCallMock).toHaveBeenNthCalledWith(1, "techtree.v1.reviewer.orcid.link", undefined, undefined);
    expect(daemonCallMock).toHaveBeenNthCalledWith(
      2,
      "techtree.v1.reviewer.orcid.link",
      { request_id: "orcid_req_test" },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: {
        request_id: "orcid_req_test",
        state: "authenticated",
        reviewer: {
          wallet_address: "0x1111111111111111111111111111111111111111",
          orcid_id: "0000-0000-0000-0001",
          vetting_status: "pending",
          domain_tags: ["scrna-seq"],
        },
      },
    });
  });

  it("applies reviewer tags from repeated --tag flags", async () => {
    daemonCallMock.mockResolvedValue({
      data: {
        wallet_address: "0x1111111111111111111111111111111111111111",
        domain_tags: ["scrna-seq", "bulk-rna"],
        vetting_status: "pending",
      },
    });

    const { runTechtreeReviewerApply } = await import("../../src/commands/techtree-v1-reviewer.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeReviewerApply(
        parseCliArgs([
          "techtree",
          "reviewer",
          "apply",
          "--tag",
          "scrna-seq",
          "--tag",
          "bulk-rna",
          "--summary",
          "Reviewed RNA workflows",
        ]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.reviewer.apply",
      {
        domain_tags: ["scrna-seq", "bulk-rna"],
        experience_summary: "Reviewed RNA workflows",
      },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: {
        wallet_address: "0x1111111111111111111111111111111111111111",
        domain_tags: ["scrna-seq", "bulk-rna"],
        vetting_status: "pending",
      },
    });
  });

  it("fails clearly on an invalid ORCID response envelope", async () => {
    daemonCallMock.mockResolvedValue({ request_id: "orcid_req_test", state: "pending" });

    const { runTechtreeReviewerOrcidLink } = await import("../../src/commands/techtree-v1-reviewer.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    await expect(
      runTechtreeReviewerOrcidLink(
        parseCliArgs([
          "techtree",
          "reviewer",
          "orcid",
          "link",
          "--poll-interval-ms",
          "1",
          "--timeout-ms",
          "10",
        ]),
      ),
    ).rejects.toThrow("invalid ORCID link response envelope");
  });
});
