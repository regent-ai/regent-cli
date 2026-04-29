import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildContractDoctorReport } from "../src/commands/doctor.js";
import { route, routeMatches } from "../src/routes/shared.js";

const workspaceRoot = path.resolve(import.meta.dirname, "../../..");
const sharedApi = path.join(workspaceRoot, "docs/regent-services-contract.openapiv3.yaml");
const sharedCli = path.join(workspaceRoot, "docs/shared-cli-contract.yaml");
const sharedGenerated = path.join(workspaceRoot, "packages/regents-cli/src/generated/regent-services-openapi.ts");

const writeRegistry = (body: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "regent-interface-registry-"));
  const registryPath = path.join(dir, "regent-interface-registry.yaml");
  fs.writeFileSync(registryPath, body, "utf8");
  return registryPath;
};

describe("contract observability", () => {
  it("reports loaded contracts, generated files, command coverage, and base URLs from the interface registry", () => {
    const registryPath = writeRegistry(`
interfaces:
  shared_services:
    repo: regents-cli
    api_contracts:
      - ${sharedApi}
    cli_contracts:
      - ${sharedCli}
    generated_bindings:
      - path: ${sharedGenerated}
        source_contract: ${sharedApi}
    release_artifacts:
      - ${sharedApi}
    minimum_ci_checkout:
      repos:
        - regents-cli
`);
    const report = buildContractDoctorReport(undefined, { registryPath });

    expect(report.command).toBe("regents doctor contracts");
    expect(report.registryPath).toBe(registryPath);
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: "shared_services",
          kind: "cli",
          loaded: true,
          commandStatus: "covered",
        }),
        expect.objectContaining({
          owner: "shared_services",
          kind: "api",
          loaded: true,
          generatedStatus: expect.stringMatching(/^(present|stale)$/u),
        }),
      ]),
    );
    expect(report.summary.loaded).toBeGreaterThan(0);
  });

  it("reports a clear failure when the interface registry is missing", () => {
    const registryPath = path.join(os.tmpdir(), "regent-missing-interface-registry.yaml");

    expect(() => buildContractDoctorReport(undefined, { registryPath })).toThrow(
      `Regent interface registry is missing: ${registryPath}`,
    );
  });

  it("does not match extra words unless the route declares them", () => {
    const exact = route("techtree status", async () => 0);
    const variadic = route("doctor", async () => 0, { variadicTail: true });

    expect(routeMatches(exact, ["techtree", "status"])).toBe(true);
    expect(routeMatches(exact, ["techtree", "status", "extra"])).toBe(false);
    expect(routeMatches(variadic, ["doctor", "auth"])).toBe(true);
  });
});
