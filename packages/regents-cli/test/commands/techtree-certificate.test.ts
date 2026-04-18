import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOutput, parsePrintedJson } from "../helpers/output.js";

const { daemonCallMock } = vi.hoisted(() => ({
  daemonCallMock: vi.fn(),
}));

vi.mock("../../src/daemon-client.js", () => ({
  daemonCall: daemonCallMock,
}));

describe("certificate command group", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("verifies certificate status for a capsule", async () => {
    daemonCallMock.mockResolvedValue({
      data: {
        capsule_id: "capsule_draft_test",
        status: "active",
        certificate_review_id: "0xreview0000000000000000000000000000000000000000000000000000000000",
      },
    });

    const { runTechtreeCertificateVerify } = await import("../../src/commands/techtree-v1-certificate.js");
    const { parseCliArgs } = await import("../../src/parse.js");

    const output = await captureOutput(() =>
      runTechtreeCertificateVerify(
        parseCliArgs(["techtree", "certificate", "verify", "capsule_draft_test"]),
      ),
    );

    expect(output.result).toBeUndefined();
    expect(daemonCallMock).toHaveBeenCalledWith(
      "techtree.v1.certificate.verify",
      { capsule_id: "capsule_draft_test" },
      undefined,
    );
    expect(parsePrintedJson(output.stdout)).toEqual({
      data: {
        capsule_id: "capsule_draft_test",
        status: "active",
        certificate_review_id: "0xreview0000000000000000000000000000000000000000000000000000000000",
      },
    });
  });
});
