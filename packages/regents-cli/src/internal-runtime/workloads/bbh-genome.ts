import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  BbhGenomeImproveResponse,
  BbhGenomeImproverProgram,
  BbhGenomeImproverScope,
  BbhGenomeImproverScoreboard,
  BbhGenomeImproverTrial,
  BbhGenomeInitResponse,
  BbhGenomeRecommendationSource,
  BbhGenomeScoreResponse,
  BbhGenomeSource,
  RegentConfig,
  RegentResolvedRunMetadata,
} from "../../internal-types/index.js";

import type { TechtreeClient } from "../techtree/client.js";
import { materializeBbhWorkspace } from "./bbh.js";

const DEFAULT_BUDGET = 6;
const DEFAULT_SAMPLE_SIZE = 3;
const PROGRAM_BLOCK_RE = /```json\s*([\s\S]*?)```/i;
const SUPPORTED_SEARCH_FIELDS = [
  "model_id",
  "harness_type",
  "harness_version",
  "prompt_pack_version",
  "skill_pack_version",
  "tool_profile",
  "runtime_image",
  "data_profile",
] as const;

const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const nowIso = (): string => new Date().toISOString();
const shortHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJsonFile = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, "utf8")) as T;

const readTextFile = async (filePath: string): Promise<string> => fs.readFile(filePath, "utf8");

const readRequiredJsonFile = async <T>(filePath: string): Promise<T> => {
  if (!(await fileExists(filePath))) {
    throw new Error(`missing required file: ${path.relative(process.cwd(), filePath)}`);
  }

  try {
    return await readJsonFile<T>(filePath);
  } catch {
    throw new Error(`invalid JSON in ${path.relative(process.cwd(), filePath)}`);
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isGenomeSource = (value: unknown): value is BbhGenomeSource =>
  isObject(value) && value.schema_version === "techtree.bbh.genome-source.v1";

const normalizeGenomeSource = (input: Partial<BbhGenomeSource>): BbhGenomeSource => {
  const base = {
    model_id: input.model_id ?? "unknown-model",
    harness_type: input.harness_type ?? "custom",
    harness_version: input.harness_version ?? "local",
    prompt_pack_version: input.prompt_pack_version ?? "bbh-v0.1",
    skill_pack_version: input.skill_pack_version ?? "techtree-bbh-v0.1",
    tool_profile: input.tool_profile ?? "owner",
    runtime_image: input.runtime_image ?? "local-runtime",
    helper_code_hash: input.helper_code_hash ?? null,
    data_profile: input.data_profile ?? null,
    axes: isObject(input.axes) ? input.axes : {},
    label: input.label ?? `${input.model_id ?? "unknown-model"}:${input.tool_profile ?? "owner"}`,
    parent_genome_ref: input.parent_genome_ref ?? null,
    notes: input.notes ?? null,
  } satisfies Omit<BbhGenomeSource, "schema_version" | "genome_id">;

  return {
    schema_version: "techtree.bbh.genome-source.v1",
    genome_id: `gen_${shortHash(base)}`,
    ...base,
  };
};

const genomeDir = (workspacePath: string): string => path.join(path.resolve(workspacePath), "genome");
const trialsDir = (workspacePath: string): string => path.join(genomeDir(workspacePath), "trials");
const baselinePath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "baseline.source.yaml");
const candidatePath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "candidate.source.yaml");
const recommendedPath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "recommended.source.yaml");
const programPath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "program.md");
const notesPath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "notes.md");
const experimentsPath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "experiments.jsonl");
const scoreboardPath = (workspacePath: string): string => path.join(genomeDir(workspacePath), "scoreboard.json");

const defaultProgram = (scope: BbhGenomeImproverScope, budget: number): string => `# BBH Genome Improver

This file is the human-written search directive for the genome improver.

Edit the JSON block below to define the evaluation scope and the mutations the CLI should explore.

\`\`\`json
${JSON.stringify(
  {
    budget,
    evaluation_scope: scope,
    search: {
      model_id: ["unknown-model"],
      prompt_pack_version: ["bbh-v0.1"],
      skill_pack_version: ["techtree-bbh-v0.1"],
      tool_profile: ["owner"],
      axes: [
        {},
      ],
    },
  },
  null,
  2,
)}
\`\`\`

Use this like AutoAgent's \`program.md\`: change the search space here, then rerun \`regents techtree bbh genome improve\`.

The BBH run workspaces spawned from this program also carry \`search.config.yaml\`, \`outputs/skydiscover/search.log\`, and \`outputs/skydiscover/search_summary.json\` beside the usual run files.
`;

const defaultRecommendation = (baseline: BbhGenomeSource, scope: BbhGenomeImproverScope): BbhGenomeRecommendationSource => ({
  schema_version: "techtree.bbh.genome-recommendation.v1",
  recommended_genome_id: baseline.genome_id ?? null,
  baseline_genome_id: baseline.genome_id ?? null,
  improver_kind: "autoagent-style",
  evaluation_scope: scope,
  trial_count: 0,
  best_score: null,
  notes: [],
  genome_source: baseline,
});

const defaultScoreboard = (
  baseline: BbhGenomeSource,
  scope: BbhGenomeImproverScope,
  budget: number,
): BbhGenomeImproverScoreboard => ({
  schema_version: "techtree.bbh.genome-scoreboard.v1",
  budget,
  evaluation_scope: scope,
  baseline_genome_id: baseline.genome_id!,
  candidate_genome_id: baseline.genome_id!,
  recommended_genome_id: baseline.genome_id!,
  best_score: null,
  completed_trials: 0,
  pending_trials: 0,
  trials: [],
  last_updated_at: nowIso(),
});

const appendExperiment = async (workspacePath: string, event: Record<string, unknown>): Promise<void> => {
  await fs.appendFile(experimentsPath(workspacePath), `${JSON.stringify({ at: nowIso(), ...event })}\n`, "utf8");
};

const parseProgram = async (workspacePath: string): Promise<BbhGenomeImproverProgram> => {
  const body = await readTextFile(programPath(workspacePath));
  const match = body.match(PROGRAM_BLOCK_RE);
  if (!match) {
    throw new Error("genome/program.md must contain a ```json``` block");
  }

  try {
    const parsed = JSON.parse(match[1]) as BbhGenomeImproverProgram;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("genome/program.md contains invalid JSON");
  }
};

const parseScope = (input: BbhGenomeImproverProgram["evaluation_scope"] | null | undefined): BbhGenomeImproverScope => {
  const scope = input ?? {};
  if (Array.isArray(scope.capsule_ids) && scope.capsule_ids.length > 0) {
    return { capsule_ids: scope.capsule_ids.map(String) };
  }

  return {
    split: scope.split ?? "climb",
    sample_size: Number.isInteger(scope.sample_size) && Number(scope.sample_size) > 0
      ? Number(scope.sample_size)
      : DEFAULT_SAMPLE_SIZE,
  };
};

const parseBudget = (input: number | undefined): number =>
  Number.isInteger(input) && Number(input) > 0 ? Number(input) : DEFAULT_BUDGET;

const readGenomeSource = async (filePath: string): Promise<BbhGenomeSource> => {
  const payload = await readRequiredJsonFile<unknown>(filePath);
  if (!isGenomeSource(payload)) {
    throw new Error(`${path.relative(process.cwd(), filePath)} must declare techtree.bbh.genome-source.v1`);
  }
  return normalizeGenomeSource(payload);
};

const readScoreboard = async (workspacePath: string): Promise<BbhGenomeImproverScoreboard> =>
  readRequiredJsonFile<BbhGenomeImproverScoreboard>(scoreboardPath(workspacePath));

const readRecommendation = async (workspacePath: string): Promise<BbhGenomeRecommendationSource> =>
  readRequiredJsonFile<BbhGenomeRecommendationSource>(recommendedPath(workspacePath));

const writeScoreboard = async (workspacePath: string, scoreboard: BbhGenomeImproverScoreboard): Promise<void> => {
  scoreboard.last_updated_at = nowIso();
  await fs.writeFile(scoreboardPath(workspacePath), jsonText(scoreboard), "utf8");
};

const writeRecommendation = async (
  workspacePath: string,
  recommendation: BbhGenomeRecommendationSource,
): Promise<void> => {
  await fs.writeFile(recommendedPath(workspacePath), jsonText(recommendation), "utf8");
};

const resolveScopeCapsuleIds = async (
  client: TechtreeClient,
  scope: BbhGenomeImproverScope,
): Promise<string[]> => {
  if (Array.isArray(scope.capsule_ids) && scope.capsule_ids.length > 0) {
    return scope.capsule_ids;
  }

  const split = scope.split ?? "climb";
  const sampleSize = scope.sample_size ?? DEFAULT_SAMPLE_SIZE;
  const response = await client.listBbhCapsules({ split });
  return response.data.slice(0, sampleSize).map((capsule) => capsule.capsule_id);
};

const trialWorkspacePath = (workspacePath: string, trialId: string): string =>
  path.join(trialsDir(workspacePath), trialId);

const trialRunWorkspacePath = (workspacePath: string, trialId: string, capsuleId: string): string =>
  path.join(trialWorkspacePath(workspacePath, trialId), "runs", capsuleId);

const createTrial = (
  kind: BbhGenomeImproverTrial["kind"],
  genome: BbhGenomeSource,
  workspacePath: string,
): BbhGenomeImproverTrial => ({
  trial_id: `${kind}_${shortHash({ genome_id: genome.genome_id, workspacePath })}`,
  genome_id: genome.genome_id!,
  status: "pending",
  kind,
  workspace_path: trialWorkspacePath(workspacePath, `${kind}_${shortHash({ genome_id: genome.genome_id, workspacePath })}`),
  completed_runs: 0,
  total_runs: 0,
  mean_normalized_score: null,
});

const upsertTrial = (
  trials: BbhGenomeImproverTrial[],
  next: BbhGenomeImproverTrial,
): BbhGenomeImproverTrial[] => {
  const existing = trials.findIndex((trial) => trial.trial_id === next.trial_id);
  if (existing >= 0) {
    const updated = [...trials];
    updated[existing] = { ...updated[existing], ...next };
    return updated;
  }

  return [...trials, next];
};

const extractNormalizedScore = (verdict: Record<string, unknown>): number | null => {
  if (verdict.decision === "inconclusive") {
    return null;
  }

  const metrics = isObject(verdict.metrics) ? verdict.metrics : null;
  if (!metrics) {
    return null;
  }

  if (typeof metrics.normalized_score === "number") {
    return metrics.normalized_score;
  }

  if (typeof metrics.score === "number") {
    const score = metrics.score;
    if (score >= 0 && score <= 1) {
      return score;
    }

    if (score >= 0 && score <= 100) {
      return score / 100;
    }
  }

  if (typeof metrics.raw_score === "number") {
    const score = metrics.raw_score;
    if (score >= 0 && score <= 1) {
      return score;
    }
  }

  return null;
};

const mean = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
};

const tryReadVerdictScore = async (runWorkspacePath: string): Promise<number | null> => {
  const verdictPath = path.join(runWorkspacePath, "outputs", "verdict.json");
  if (!(await fileExists(verdictPath))) {
    return null;
  }

  try {
    const verdict = await readJsonFile<Record<string, unknown>>(verdictPath);
    return extractNormalizedScore(verdict);
  } catch {
    return null;
  }
};

const scalarMutations = (
  genome: BbhGenomeSource,
  program: BbhGenomeImproverProgram,
): BbhGenomeSource[] => {
  const search = program.search ?? {};
  const candidates: BbhGenomeSource[] = [];

  for (const field of SUPPORTED_SEARCH_FIELDS) {
    const values = search[field];
    if (!Array.isArray(values)) {
      continue;
    }

    for (const nextValue of values) {
      if (nextValue === undefined || nextValue === genome[field]) {
        continue;
      }

      candidates.push(
        normalizeGenomeSource({
          ...genome,
          [field]: nextValue,
          parent_genome_ref: genome.genome_id ?? null,
        }),
      );
    }
  }

  if (Array.isArray(search.axes)) {
    for (const axes of search.axes) {
      if (!isObject(axes)) {
        continue;
      }

      const normalized = normalizeGenomeSource({
        ...genome,
        axes,
        parent_genome_ref: genome.genome_id ?? null,
      });

      if (JSON.stringify(normalized.axes ?? {}) !== JSON.stringify(genome.axes ?? {})) {
        candidates.push(normalized);
      }
    }
  }

  return candidates;
};

const uniqueByGenomeId = (genomes: BbhGenomeSource[]): BbhGenomeSource[] => {
  const seen = new Set<string>();
  const unique: BbhGenomeSource[] = [];

  for (const genome of genomes) {
    if (!genome.genome_id || seen.has(genome.genome_id)) {
      continue;
    }

    seen.add(genome.genome_id);
    unique.push(genome);
  }

  return unique;
};

const ensureTrialRuns = async (
  client: TechtreeClient,
  config: RegentConfig,
  workspacePath: string,
  trial: BbhGenomeImproverTrial,
  genome: BbhGenomeSource,
  metadata: RegentResolvedRunMetadata,
  capsuleIds: string[],
): Promise<void> => {
  await ensureDir(path.join(trial.workspace_path, "runs"));
  await fs.writeFile(path.join(trial.workspace_path, "candidate.source.yaml"), jsonText(genome), "utf8");

  for (const capsuleId of capsuleIds) {
    const runWorkspacePath = trialRunWorkspacePath(workspacePath, trial.trial_id, capsuleId);
    const runSourcePath = path.join(runWorkspacePath, "run.source.yaml");
    if (await fileExists(runSourcePath)) {
      continue;
    }

    await materializeBbhWorkspace(
      client,
      config,
      {
        workspace_path: runWorkspacePath,
        capsule_id: capsuleId,
        genome,
      },
      metadata,
    );
  }
};

const scoreTrial = async (
  workspacePath: string,
  trial: BbhGenomeImproverTrial,
  capsuleIds: string[],
): Promise<BbhGenomeImproverTrial> => {
  const scores: number[] = [];

  for (const capsuleId of capsuleIds) {
    const score = await tryReadVerdictScore(trialRunWorkspacePath(workspacePath, trial.trial_id, capsuleId));
    if (typeof score === "number") {
      scores.push(score);
    }
  }

  const completedRuns = scores.length;
  const totalRuns = capsuleIds.length;
  const meanScore = mean(scores);

  return {
    ...trial,
    completed_runs: completedRuns,
    total_runs: totalRuns,
    mean_normalized_score: meanScore,
    status:
      completedRuns === 0
        ? "pending"
        : completedRuns < totalRuns
          ? "partial"
          : "completed",
  };
};

const formatScope = (scope: BbhGenomeImproverScope): string =>
  Array.isArray(scope.capsule_ids) && scope.capsule_ids.length > 0
    ? scope.capsule_ids.join(", ")
    : `${scope.split ?? "climb"} x ${scope.sample_size ?? DEFAULT_SAMPLE_SIZE}`;

const recommendationNotes = (
  scoreboard: BbhGenomeImproverScoreboard,
  bestGenome: BbhGenomeSource | null,
): string[] => [
  `Scope: ${formatScope(scoreboard.evaluation_scope)}`,
  `Trials observed: ${scoreboard.trials.length}`,
  `Completed trials: ${scoreboard.completed_trials}`,
  `Best score: ${scoreboard.best_score === null ? "pending" : scoreboard.best_score.toFixed(3)}`,
  ...(bestGenome?.parent_genome_ref ? [`Parent genome: ${bestGenome.parent_genome_ref}`] : []),
];

const defaultProposalSummary = (scoreboard: BbhGenomeImproverScoreboard): string =>
  `autoagent-style genome update: best score ${
    scoreboard.best_score === null ? "pending" : scoreboard.best_score.toFixed(3)
  } across ${formatScope(scoreboard.evaluation_scope)}`;

const updateRecommendationFromBest = async (
  workspacePath: string,
  scoreboard: BbhGenomeImproverScoreboard,
  bestGenome: BbhGenomeSource | null,
): Promise<void> => {
  const baselineGenome = await readGenomeSource(baselinePath(workspacePath));
  const recommendation: BbhGenomeRecommendationSource = {
    schema_version: "techtree.bbh.genome-recommendation.v1",
    recommended_genome_id: bestGenome?.genome_id ?? null,
    baseline_genome_id: baselineGenome.genome_id ?? null,
    improver_kind: "autoagent-style",
    evaluation_scope: scoreboard.evaluation_scope,
    trial_count: scoreboard.trials.length,
    best_score: scoreboard.best_score,
    notes: recommendationNotes(scoreboard, bestGenome),
    genome_source: bestGenome,
  };

  await writeRecommendation(workspacePath, recommendation);
};

const ensureInitialized = async (workspacePath: string): Promise<void> => {
  if (!(await fileExists(baselinePath(workspacePath)))) {
    throw new Error("genome workspace is not initialized; run `regents techtree bbh genome init` first");
  }
};

const refreshScoreboard = async (
  client: TechtreeClient,
  config: RegentConfig,
  workspacePath: string,
  metadata: RegentResolvedRunMetadata,
): Promise<BbhGenomeImproverScoreboard> => {
  await ensureInitialized(workspacePath);

  const program = await parseProgram(workspacePath);
  const baselineGenome = await readGenomeSource(baselinePath(workspacePath));
  const candidateGenome = await readGenomeSource(candidatePath(workspacePath));
  const scoreboard = await readScoreboard(workspacePath);
  const scope = parseScope(program.evaluation_scope ?? scoreboard.evaluation_scope);
  const budget = parseBudget(program.budget ?? scoreboard.budget);
  const capsuleIds = await resolveScopeCapsuleIds(client, scope);

  const baselineTrial = createTrial("baseline", baselineGenome, workspacePath);
  const candidateKind =
    candidateGenome.genome_id === baselineGenome.genome_id ? "baseline" : "candidate";
  const candidateTrial = createTrial(candidateKind, candidateGenome, workspacePath);

  let trials = upsertTrial(scoreboard.trials, baselineTrial);
  trials = upsertTrial(trials, candidateTrial);

  await ensureTrialRuns(client, config, workspacePath, baselineTrial, baselineGenome, metadata, capsuleIds);
  await ensureTrialRuns(client, config, workspacePath, candidateTrial, candidateGenome, metadata, capsuleIds);

  const scoredTrials: BbhGenomeImproverTrial[] = [];
  for (const trial of trials) {
    const genomeFile = path.join(trial.workspace_path, "candidate.source.yaml");
    if (!(await fileExists(genomeFile))) {
      continue;
    }
    scoredTrials.push(await scoreTrial(workspacePath, trial, capsuleIds));
  }

  const completed = scoredTrials.filter((trial) => trial.status === "completed" && trial.mean_normalized_score !== null);
  const bestTrial = completed.sort((left, right) => (right.mean_normalized_score ?? -1) - (left.mean_normalized_score ?? -1))[0];
  const bestGenome =
    bestTrial && (await fileExists(path.join(bestTrial.workspace_path, "candidate.source.yaml")))
      ? await readGenomeSource(path.join(bestTrial.workspace_path, "candidate.source.yaml"))
      : null;

  const nextScoreboard: BbhGenomeImproverScoreboard = {
    schema_version: "techtree.bbh.genome-scoreboard.v1",
    budget,
    evaluation_scope: Array.isArray(scope.capsule_ids) ? { capsule_ids: scope.capsule_ids } : scope,
    baseline_genome_id: baselineGenome.genome_id!,
    candidate_genome_id: candidateGenome.genome_id!,
    recommended_genome_id: bestGenome?.genome_id ?? null,
    best_score: bestTrial?.mean_normalized_score ?? null,
    completed_trials: completed.length,
    pending_trials: scoredTrials.filter((trial) => trial.status !== "completed").length,
    trials: scoredTrials.sort((left, right) => left.trial_id.localeCompare(right.trial_id)),
    last_updated_at: nowIso(),
  };

  await writeScoreboard(workspacePath, nextScoreboard);
  await updateRecommendationFromBest(workspacePath, nextScoreboard, bestGenome);
  return nextScoreboard;
};

export async function initBbhGenomeWorkspace(
  workspacePath: string,
  baselineGenomeInput: Partial<BbhGenomeSource>,
  options?: {
    budget?: number;
    scope?: BbhGenomeImproverScope;
  },
): Promise<BbhGenomeInitResponse> {
  const resolvedWorkspace = path.resolve(workspacePath);
  await ensureDir(genomeDir(resolvedWorkspace));

  if (await fileExists(baselinePath(resolvedWorkspace))) {
    throw new Error("genome workspace already initialized");
  }

  const baselineGenome = normalizeGenomeSource(baselineGenomeInput);
  const scope = parseScope(options?.scope);
  const budget = parseBudget(options?.budget);

  await fs.writeFile(baselinePath(resolvedWorkspace), jsonText(baselineGenome), "utf8");
  await fs.writeFile(candidatePath(resolvedWorkspace), jsonText(baselineGenome), "utf8");
  await writeRecommendation(resolvedWorkspace, defaultRecommendation(baselineGenome, scope));
  await fs.writeFile(programPath(resolvedWorkspace), defaultProgram(scope, budget), "utf8");
  await fs.writeFile(notesPath(resolvedWorkspace), "# Genome notes\n", "utf8");
  await fs.writeFile(experimentsPath(resolvedWorkspace), "", "utf8");
  await writeScoreboard(resolvedWorkspace, defaultScoreboard(baselineGenome, scope, budget));
  await ensureDir(trialsDir(resolvedWorkspace));
  await appendExperiment(resolvedWorkspace, {
    event: "genome_init",
    baseline_genome_id: baselineGenome.genome_id,
    evaluation_scope: scope,
    budget,
  });

  return {
    ok: true,
    entrypoint: "bbh.genome.init",
    workspace_path: resolvedWorkspace,
    files: [
      "genome/baseline.source.yaml",
      "genome/candidate.source.yaml",
      "genome/recommended.source.yaml",
      "genome/program.md",
      "genome/notes.md",
      "genome/experiments.jsonl",
      "genome/scoreboard.json",
    ],
    baseline_genome_id: baselineGenome.genome_id!,
    evaluation_scope: scope,
  };
}

export async function scoreBbhGenomeWorkspace(
  client: TechtreeClient,
  config: RegentConfig,
  workspacePath: string,
  metadata: RegentResolvedRunMetadata,
): Promise<BbhGenomeScoreResponse> {
  const scoreboard = await refreshScoreboard(client, config, workspacePath, metadata);
  await appendExperiment(workspacePath, {
    event: "genome_score",
    best_score: scoreboard.best_score,
    completed_trials: scoreboard.completed_trials,
    pending_trials: scoreboard.pending_trials,
  });

  return {
    ok: true,
    entrypoint: "bbh.genome.score",
    workspace_path: path.resolve(workspacePath),
    scoreboard,
  };
}

export async function improveBbhGenomeWorkspace(
  client: TechtreeClient,
  config: RegentConfig,
  workspacePath: string,
  metadata: RegentResolvedRunMetadata,
): Promise<BbhGenomeImproveResponse> {
  const resolvedWorkspace = path.resolve(workspacePath);
  let scoreboard = await refreshScoreboard(client, config, resolvedWorkspace, metadata);
  const program = await parseProgram(resolvedWorkspace);
  const budget = parseBudget(program.budget ?? scoreboard.budget);
  const scope = parseScope(program.evaluation_scope ?? scoreboard.evaluation_scope);
  const capsuleIds = await resolveScopeCapsuleIds(client, scope);
  const baselineGenome = await readGenomeSource(baselinePath(resolvedWorkspace));
  const currentCandidate = await readGenomeSource(candidatePath(resolvedWorkspace));

  const bestGenomeId = scoreboard.recommended_genome_id ?? currentCandidate.genome_id ?? baselineGenome.genome_id ?? null;
  const bestTrial = scoreboard.trials.find((trial) => trial.genome_id === bestGenomeId);
  const bestGenome =
    bestTrial && (await fileExists(path.join(bestTrial.workspace_path, "candidate.source.yaml")))
      ? await readGenomeSource(path.join(bestTrial.workspace_path, "candidate.source.yaml"))
      : currentCandidate;

  if (scoreboard.best_score !== null && bestGenome.genome_id !== currentCandidate.genome_id) {
    await fs.writeFile(candidatePath(resolvedWorkspace), jsonText(bestGenome), "utf8");
    await appendExperiment(resolvedWorkspace, {
      event: "candidate_promoted",
      genome_id: bestGenome.genome_id,
      best_score: scoreboard.best_score,
    });
    scoreboard = await refreshScoreboard(client, config, resolvedWorkspace, metadata);
  }

  if (scoreboard.trials.length >= budget) {
    return {
      ok: true,
      entrypoint: "bbh.genome.improve",
      workspace_path: resolvedWorkspace,
      scoreboard,
      next_trial_id: null,
      recommended_genome_id: scoreboard.recommended_genome_id,
    };
  }

  const triedGenomeIds = new Set(scoreboard.trials.map((trial) => trial.genome_id));
  const mutationCandidates = uniqueByGenomeId(scalarMutations(bestGenome, program)).filter(
    (genome) => genome.genome_id && !triedGenomeIds.has(genome.genome_id),
  );

  const nextGenome = mutationCandidates[0];
  if (!nextGenome) {
    return {
      ok: true,
      entrypoint: "bbh.genome.improve",
      workspace_path: resolvedWorkspace,
      scoreboard,
      next_trial_id: null,
      recommended_genome_id: scoreboard.recommended_genome_id,
    };
  }

  const nextTrial = createTrial("mutation", nextGenome, resolvedWorkspace);
  await ensureTrialRuns(client, config, resolvedWorkspace, nextTrial, nextGenome, metadata, capsuleIds);
  scoreboard.trials = upsertTrial(scoreboard.trials, nextTrial);
  scoreboard.pending_trials = scoreboard.trials.filter((trial) => trial.status !== "completed").length;
  scoreboard.last_updated_at = nowIso();
  await writeScoreboard(resolvedWorkspace, scoreboard);
  await appendExperiment(resolvedWorkspace, {
    event: "trial_created",
    trial_id: nextTrial.trial_id,
    genome_id: nextGenome.genome_id,
    parent_genome_ref: nextGenome.parent_genome_ref ?? null,
  });

  return {
    ok: true,
    entrypoint: "bbh.genome.improve",
    workspace_path: resolvedWorkspace,
    scoreboard,
    next_trial_id: nextTrial.trial_id,
    recommended_genome_id: scoreboard.recommended_genome_id,
  };
}

export async function genomeProposalSummary(workspacePath: string, explicitSummary?: string | null): Promise<string> {
  if (explicitSummary && explicitSummary.trim() !== "") {
    return explicitSummary;
  }

  const scoreboard = await readScoreboard(workspacePath);
  return defaultProposalSummary(scoreboard);
}
