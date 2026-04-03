import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { solveBbhWorkspace } from "../../src/internal-runtime/workloads/bbh-solve.js";

const tempRoots: string[] = [];

const makeTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })));
});

const baseConfig = (root: string) =>
  ({
    agents: {
      harnesses: {
        hermes: {
          workspaceRoot: path.join(root, "workspaces", "hermes"),
          entrypoint: "hermes",
        },
        openclaw: {
          workspaceRoot: path.join(root, "workspaces", "openclaw"),
          entrypoint: "openclaw",
        },
      },
    },
  }) as any;

const baseMetadata = {
  resolved_at: "2026-04-03T00:00:00.000Z",
  executor_harness: { kind: "hermes", profile: "bbh", entrypoint: "hermes" },
  origin: { kind: "local", transport: "api", session_id: null, trigger_ref: null },
  executor_harness_kind: "hermes",
  executor_harness_profile: "bbh",
  origin_session_id: null,
} as const;

const seedWorkspace = async (workspacePath: string): Promise<void> => {
  await fs.mkdir(path.join(workspacePath, "outputs"), { recursive: true });
  await fs.mkdir(path.join(workspacePath, "data"), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "genome.source.yaml"),
    JSON.stringify({
      schema_version: "techtree.bbh.genome-source.v1",
      model_id: "gpt-test",
      harness_type: "hermes",
      harness_version: "1.0.0",
      prompt_pack_version: "bbh-v0.1",
      skill_pack_version: "techtree-bbh-v0.1",
      tool_profile: "bbh",
      runtime_image: "local",
    }),
    "utf8",
  );
  await fs.writeFile(
    path.join(workspacePath, "run.source.yaml"),
    JSON.stringify({
      schema_version: "techtree.bbh.run-source.v1",
      artifact_ref: "capsule_1",
      executor: { type: "genome", id: "gen_1", harness: "hermes", harness_version: "1.0.0" },
      instance: { instance_ref: "capsule_1" },
      bbh: { split: "climb", provider: "bbh_train" },
    }),
    "utf8",
  );
  await fs.writeFile(path.join(workspacePath, "task.json"), JSON.stringify({ objective: "solve" }), "utf8");
  await fs.writeFile(path.join(workspacePath, "protocol.md"), "1. Solve it\n", "utf8");
  await fs.writeFile(path.join(workspacePath, "rubric.json"), JSON.stringify({ items: [] }), "utf8");
  await fs.writeFile(path.join(workspacePath, "analysis.py"), "print('analysis')\n", "utf8");
  await fs.writeFile(path.join(workspacePath, "final_answer.md"), "", "utf8");
  await fs.writeFile(
    path.join(workspacePath, "outputs", "verdict.json"),
    JSON.stringify({
      decision: "inconclusive",
      justification: "Pending notebook execution.",
      metrics: { raw_score: 0, normalized_score: 0 },
    }),
    "utf8",
  );
  await fs.writeFile(path.join(workspacePath, "data", "sample.txt"), "sample\n", "utf8");
};

describe("bbh solve workload", () => {
  it("solves a workspace through an isolated harness copy and syncs back only allowed files", async () => {
    const root = await makeTempDir("bbh-solve-success-");
    const workspace = path.join(root, "run-1");
    await seedWorkspace(workspace);

    const response = await solveBbhWorkspace(
      baseConfig(root),
      { workspace_path: workspace, agent: "hermes", timeout_seconds: 30 },
      baseMetadata,
      {
        runAgent: async ({ workspacePath, logPath }) => {
          await fs.writeFile(path.join(workspacePath, "analysis.py"), "print('improved')\n", "utf8");
          await fs.writeFile(path.join(workspacePath, "final_answer.md"), "Solved in plain English.\n", "utf8");
          await fs.writeFile(
            path.join(workspacePath, "outputs", "verdict.json"),
            JSON.stringify({
              decision: "support",
              justification: "Evidence supports the claim.",
              metrics: { raw_score: 0.8, normalized_score: 0.9 },
            }),
            "utf8",
          );
          await fs.writeFile(path.join(workspacePath, "outputs", "report.html"), "<html>ok</html>\n", "utf8");
          await fs.writeFile(logPath, "solver log\n", "utf8");
          return { exitCode: 0 };
        },
      },
    );

    expect(response.agent).toBe("hermes");
    expect(response.verdict_summary).toEqual({
      decision: "support",
      raw_score: 0.8,
      normalized_score: 0.9,
    });
    expect(response.produced_files).toEqual(
      expect.arrayContaining([
        "analysis.py",
        "final_answer.md",
        "outputs/verdict.json",
        "outputs/report.html",
        "outputs/run.log",
      ]),
    );
    expect(await fs.readFile(path.join(workspace, "analysis.py"), "utf8")).toContain("improved");
    expect(await fs.readFile(path.join(workspace, "final_answer.md"), "utf8")).toContain("Solved");
    expect(await fs.readFile(path.join(workspace, "outputs", "run.log"), "utf8")).toContain("solver log");
    expect(await fs.readFile(path.join(workspace, "protocol.md"), "utf8")).toBe("1. Solve it\n");
  });

  it("fails clearly when a required scaffold file is missing", async () => {
    const root = await makeTempDir("bbh-solve-missing-");
    const workspace = path.join(root, "run-2");
    await seedWorkspace(workspace);
    await fs.rm(path.join(workspace, "rubric.json"));

    await expect(
      solveBbhWorkspace(baseConfig(root), { workspace_path: workspace }, baseMetadata, {
        runAgent: async () => ({ exitCode: 0 }),
      }),
    ).rejects.toThrow("missing required solver input: rubric.json");
  });

  it("rejects runs that modify protected workspace inputs", async () => {
    const root = await makeTempDir("bbh-solve-protected-");
    const workspace = path.join(root, "run-3");
    await seedWorkspace(workspace);

    await expect(
      solveBbhWorkspace(baseConfig(root), { workspace_path: workspace }, baseMetadata, {
        runAgent: async ({ workspacePath, logPath }) => {
          await fs.writeFile(path.join(workspacePath, "protocol.md"), "tampered\n", "utf8");
          await fs.writeFile(path.join(workspacePath, "final_answer.md"), "Solved.\n", "utf8");
          await fs.writeFile(
            path.join(workspacePath, "outputs", "verdict.json"),
            JSON.stringify({
              decision: "support",
              justification: "Tampered protocol.",
              metrics: { raw_score: 1, normalized_score: 1 },
            }),
            "utf8",
          );
          await fs.writeFile(logPath, "tampered\n", "utf8");
          return { exitCode: 0 };
        },
      }),
    ).rejects.toThrow("solver modified protected workspace inputs");
  });

  it("rejects invalid solver outputs", async () => {
    const root = await makeTempDir("bbh-solve-invalid-");
    const workspace = path.join(root, "run-4");
    await seedWorkspace(workspace);

    await expect(
      solveBbhWorkspace(baseConfig(root), { workspace_path: workspace }, baseMetadata, {
        runAgent: async ({ workspacePath, logPath }) => {
          await fs.writeFile(path.join(workspacePath, "final_answer.md"), "", "utf8");
          await fs.writeFile(path.join(workspacePath, "outputs", "verdict.json"), "{bad json", "utf8");
          await fs.writeFile(logPath, "broken\n", "utf8");
          return { exitCode: 0 };
        },
      }),
    ).rejects.toThrow("missing required solver output: final_answer.md");
  });
});
