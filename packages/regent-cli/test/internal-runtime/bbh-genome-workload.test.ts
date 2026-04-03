import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  improveBbhGenomeWorkspace,
  initBbhGenomeWorkspace,
  scoreBbhGenomeWorkspace,
} from "../../src/internal-runtime/workloads/bbh-genome.js";

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bbh-genome-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

const resolvedMetadata = {
  resolved_at: "2026-04-03T00:00:00.000Z",
  executor_harness: { kind: "claude_code", profile: "bbh-analyst", entrypoint: "regent" },
  origin: { kind: "local", transport: "api", session_id: null, trigger_ref: null },
  executor_harness_kind: "claude_code",
  executor_harness_profile: "bbh-analyst",
  origin_session_id: null,
} as const;

const config = {
  workloads: {
    bbh: {
      workspaceRoot: "/tmp/unused-bbh-root",
    },
  },
} as any;

const capsuleAssignment = (capsuleId: string) => ({
  data: {
    assignment_ref: `asg_${capsuleId}`,
    split: "climb" as const,
    capsule: {
      capsule_id: capsuleId,
      provider: "bbh_train" as const,
      provider_ref: `provider/${capsuleId}`,
      family_ref: null,
      instance_ref: capsuleId,
      split: "climb" as const,
      language: "python" as const,
      mode: "fixed" as const,
      assignment_policy: "auto" as const,
      title: `Capsule ${capsuleId}`,
      hypothesis: `Hypothesis ${capsuleId}`,
      protocol_md: "1. Run it\n",
      rubric_json: { criteria: [] },
      task_json: { capsule_id: capsuleId },
      data_files: [],
      artifact_source: {
        schema_version: "techtree.bbh.artifact-source.v1",
      },
    },
  },
});

const client = {
  listBbhCapsules: async () => ({
    data: [
      {
        capsule_id: "capsule_a",
        split: "climb" as const,
        title: "Capsule A",
        hypothesis: "Hypothesis A",
        provider: "bbh_train" as const,
        provider_ref: "provider/capsule_a",
        assignment_policy: "auto" as const,
      },
      {
        capsule_id: "capsule_b",
        split: "climb" as const,
        title: "Capsule B",
        hypothesis: "Hypothesis B",
        provider: "bbh_train" as const,
        provider_ref: "provider/capsule_b",
        assignment_policy: "auto" as const,
      },
    ],
  }),
  selectBbhAssignment: async ({ capsule_id }: { capsule_id: string }) => capsuleAssignment(capsule_id),
} as any;

const writeNormalizedScore = async (runWorkspace: string, score: number): Promise<void> => {
  await fs.mkdir(path.join(runWorkspace, "outputs"), { recursive: true });
  await fs.writeFile(
    path.join(runWorkspace, "outputs", "verdict.json"),
    JSON.stringify(
      {
        decision: "completed",
        justification: "Scored in test.",
        metrics: {
          raw_score: Number((score * 10).toFixed(2)),
          normalized_score: score,
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
};

describe("BBH genome improver workspace", () => {
  it("initializes the genome workspace files", async () => {
    const workspacePath = await makeTempDir();

    const result = await initBbhGenomeWorkspace(
      workspacePath,
      {
        model_id: "baseline-model",
        harness_type: "claude_code",
        prompt_pack_version: "bbh-v0.1",
        skill_pack_version: "techtree-bbh-v0.1",
        tool_profile: "bbh-analyst",
        runtime_image: "local-runtime",
      },
      { scope: { split: "climb", sample_size: 2 }, budget: 4 },
    );

    expect(result.entrypoint).toBe("bbh.genome.init");
    expect(result.files).toEqual([
      "genome/baseline.source.yaml",
      "genome/candidate.source.yaml",
      "genome/recommended.source.yaml",
      "genome/program.md",
      "genome/notes.md",
      "genome/experiments.jsonl",
      "genome/scoreboard.json",
    ]);
    expect(await fs.readFile(path.join(workspacePath, "genome", "program.md"), "utf8")).toContain("evaluation_scope");
  });

  it("scores scaffolded baseline runs once verdicts are present", async () => {
    const workspacePath = await makeTempDir();

    await initBbhGenomeWorkspace(
      workspacePath,
      {
        model_id: "baseline-model",
        harness_type: "claude_code",
        prompt_pack_version: "bbh-v0.1",
        skill_pack_version: "techtree-bbh-v0.1",
        tool_profile: "bbh-analyst",
        runtime_image: "local-runtime",
      },
      { scope: { split: "climb", sample_size: 2 }, budget: 4 },
    );

    const firstPass = await scoreBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);
    expect(firstPass.scoreboard.pending_trials).toBe(1);
    const baselineTrial = firstPass.scoreboard.trials[0];
    expect(baselineTrial.total_runs).toBe(2);

    await writeNormalizedScore(path.join(baselineTrial.workspace_path, "runs", "capsule_a"), 0.6);
    await writeNormalizedScore(path.join(baselineTrial.workspace_path, "runs", "capsule_b"), 0.8);

    const secondPass = await scoreBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);
    expect(secondPass.scoreboard.completed_trials).toBe(1);
    expect(secondPass.scoreboard.best_score).toBeCloseTo(0.7);
    expect(secondPass.scoreboard.recommended_genome_id).toBeTruthy();
  });

  it("creates a mutation trial and promotes it when it scores better", async () => {
    const workspacePath = await makeTempDir();

    await initBbhGenomeWorkspace(
      workspacePath,
      {
        model_id: "baseline-model",
        harness_type: "claude_code",
        prompt_pack_version: "bbh-v0.1",
        skill_pack_version: "techtree-bbh-v0.1",
        tool_profile: "bbh-analyst",
        runtime_image: "local-runtime",
      },
      { scope: { split: "climb", sample_size: 2 }, budget: 4 },
    );

    await fs.writeFile(
      path.join(workspacePath, "genome", "program.md"),
      `# BBH Genome Improver

\`\`\`json
{
  "budget": 4,
  "evaluation_scope": {
    "split": "climb",
    "sample_size": 2
  },
  "search": {
    "model_id": ["baseline-model", "challenger-model"],
    "tool_profile": ["bbh-analyst"]
  }
}
\`\`\`
`,
      "utf8",
    );

    const baselineScore = await scoreBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);
    const baselineTrial = baselineScore.scoreboard.trials[0];
    await writeNormalizedScore(path.join(baselineTrial.workspace_path, "runs", "capsule_a"), 0.4);
    await writeNormalizedScore(path.join(baselineTrial.workspace_path, "runs", "capsule_b"), 0.5);
    await scoreBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);

    const firstImprove = await improveBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);
    expect(firstImprove.next_trial_id).toBeTruthy();

    const mutationTrial = firstImprove.scoreboard.trials.find((trial) => trial.trial_id === firstImprove.next_trial_id);
    expect(mutationTrial).toBeDefined();

    await writeNormalizedScore(path.join(mutationTrial!.workspace_path, "runs", "capsule_a"), 0.9);
    await writeNormalizedScore(path.join(mutationTrial!.workspace_path, "runs", "capsule_b"), 0.8);

    const secondImprove = await improveBbhGenomeWorkspace(client, config, workspacePath, resolvedMetadata as any);
    expect(secondImprove.recommended_genome_id).not.toBeNull();

    const candidate = JSON.parse(
      await fs.readFile(path.join(workspacePath, "genome", "candidate.source.yaml"), "utf8"),
    ) as { model_id: string };
    const recommendation = JSON.parse(
      await fs.readFile(path.join(workspacePath, "genome", "recommended.source.yaml"), "utf8"),
    ) as {
      best_score: number;
      genome_source: { model_id: string };
    };

    expect(candidate.model_id).toBe("challenger-model");
    expect(recommendation.genome_source.model_id).toBe("challenger-model");
    expect(recommendation.best_score).toBeCloseTo(0.85);
  });
});
