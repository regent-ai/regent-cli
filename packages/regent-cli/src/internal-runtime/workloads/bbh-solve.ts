import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  BbhRunSource,
  BbhRunSolveParams,
  BbhRunSolveResponse,
  BbhRunSolveVerdictSummary,
  BbhSolveSolverKind,
  RegentConfig,
  RegentResolvedRunMetadata,
} from "../../internal-types/index.js";

const REQUIRED_INPUTS = [
  "genome.source.yaml",
  "run.source.yaml",
  "search.config.yaml",
  "eval/hypotest_skydiscover.py",
  "solver/initial_program.py",
  "task.json",
  "protocol.md",
  "rubric.json",
  "analysis.py",
  "final_answer.md",
  "outputs/verdict.json",
] as const;

const PROTECTED_INPUTS = [
  "genome.source.yaml",
  "run.source.yaml",
  "search.config.yaml",
  "task.json",
  "protocol.md",
  "rubric.json",
  "artifact.source.yaml",
] as const;

const SYNC_BACK_PATHS = [
  "analysis.py",
  "final_answer.md",
  "outputs/verdict.json",
  "outputs/report.html",
  "outputs/run.log",
  "outputs/skydiscover/search.log",
  "outputs/skydiscover/search_summary.json",
  "outputs/skydiscover/best_program.py",
  "outputs/skydiscover/evaluator_artifacts.json",
  "outputs/skydiscover/latest_checkpoint.txt",
  "outputs/skydiscover/best_solution.patch",
] as const;

type SupportedSolveSolver = BbhSolveSolverKind;

interface SolveSolverInvocation {
  solver: SupportedSolveSolver;
  entrypoint: string;
  workspacePath: string;
  prompt: string;
  timeoutSeconds: number;
  logPath: string;
}

interface SolveSolverResult {
  exitCode: number;
}

interface SolveOptions {
  runSolver?: (input: SolveSolverInvocation) => Promise<SolveSolverResult>;
}

const nowIso = (): string => new Date().toISOString();

const shortHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const ensureDir = async (target: string): Promise<void> => {
  await fs.mkdir(target, { recursive: true });
};

const fileExists = async (target: string): Promise<boolean> => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const readRequiredTextFile = async (target: string): Promise<string> => {
  if (!(await fileExists(target))) {
    throw new Error(`missing required solver input: ${path.basename(target)}`);
  }

  return fs.readFile(target, "utf8");
};

const readJsonFile = async <T>(target: string): Promise<T> =>
  JSON.parse(await fs.readFile(target, "utf8")) as T;

const sha256File = async (target: string): Promise<string> =>
  createHash("sha256").update(await fs.readFile(target)).digest("hex");

const walkFiles = async (root: string): Promise<string[]> => {
  const collected: string[] = [];

  const visit = async (current: string): Promise<void> => {
    if (!(await fileExists(current))) {
      return;
    }

    const stat = await fs.stat(current);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(current);
      for (const entry of entries.sort()) {
        await visit(path.join(current, entry));
      }
      return;
    }

    collected.push(current);
  };

  await visit(root);
  return collected.sort();
};

const collectProtectedFiles = async (workspacePath: string): Promise<string[]> => {
  const files = PROTECTED_INPUTS.map((entry) => path.join(workspacePath, entry));
  const dataFiles = await walkFiles(path.join(workspacePath, "data"));
  return [...files, ...dataFiles.filter((filePath) => !files.includes(filePath))];
};

const snapshotProtectedFiles = async (workspacePath: string): Promise<Map<string, string>> => {
  const files = await collectProtectedFiles(workspacePath);
  const snapshot = new Map<string, string>();

  for (const filePath of files) {
    if (!(await fileExists(filePath))) {
      continue;
    }

    snapshot.set(path.relative(workspacePath, filePath).split(path.sep).join("/"), await sha256File(filePath));
  }

  return snapshot;
};

const assertSnapshotsMatch = (
  before: Map<string, string>,
  after: Map<string, string>,
  message: string,
): void => {
  if (before.size !== after.size) {
    throw new Error(message);
  }

  for (const [relativePath, digest] of before.entries()) {
    if (after.get(relativePath) !== digest) {
      throw new Error(`${message}: ${relativePath}`);
    }
  }
};

const ensureRequiredInputs = async (workspacePath: string): Promise<void> => {
  for (const relativePath of REQUIRED_INPUTS) {
    if (!(await fileExists(path.join(workspacePath, relativePath)))) {
      throw new Error(`missing required solver input: ${relativePath}`);
    }
  }
};

const copyWorkspace = async (source: string, target: string): Promise<void> => {
  await fs.rm(target, { recursive: true, force: true });
  await ensureDir(path.dirname(target));
  await fs.cp(source, target, { recursive: true });
};

const syncFileIfPresent = async (source: string, target: string): Promise<boolean> => {
  if (!(await fileExists(source))) {
    return false;
  }

  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
  return true;
};

const syncOutputsBack = async (isolatedPath: string, targetPath: string): Promise<string[]> => {
  const produced: string[] = [];

  for (const relativePath of SYNC_BACK_PATHS) {
    const synced = await syncFileIfPresent(path.join(isolatedPath, relativePath), path.join(targetPath, relativePath));
    if (synced) {
      produced.push(relativePath);
    }
  }

  return produced;
};

const buildSolvePrompt = (
  workspacePath: string,
  metadata: RegentResolvedRunMetadata,
): string => [
  "Solve this BBH workspace locally.",
  "",
  "Read these inputs from the current working directory:",
  "- task.json",
  "- protocol.md",
  "- rubric.json",
  "- analysis.py",
  "- search.config.yaml",
  "- data/**",
  "- genome.source.yaml",
  "- run.source.yaml",
  "",
  "You may edit only these files:",
  "- analysis.py",
  "- final_answer.md",
  "- outputs/verdict.json",
  "- outputs/report.html",
  "- outputs/run.log",
  "- outputs/skydiscover/search.log",
  "- outputs/skydiscover/search_summary.json",
  "- outputs/skydiscover/best_program.py",
  "- outputs/skydiscover/evaluator_artifacts.json",
  "- outputs/skydiscover/latest_checkpoint.txt",
  "- outputs/skydiscover/best_solution.patch",
  "",
  "Do not modify any other file.",
  "Do not submit the run.",
  "",
  "Required outputs before you stop:",
  "- final_answer.md must contain the final answer in plain English.",
  "- outputs/verdict.json must be valid JSON with decision, justification, and metrics.",
  "- outputs/skydiscover/search_summary.json must describe the search session in valid JSON.",
  "",
  "Optional outputs:",
  "- outputs/report.html",
  "- outputs/run.log",
  "",
  `Workspace path: ${workspacePath}`,
  `Executor harness kind: ${metadata.executor_harness.kind}`,
  `Executor harness profile: ${metadata.executor_harness.profile}`,
  "",
  "If you cannot complete the solve, write the reason to outputs/run.log and exit.",
].join("\n");

const parseSupportedSolver = (value: string | null | undefined): SupportedSolveSolver => {
  if (value === "hermes" || value === "openclaw" || value === "skydiscover") {
    return value;
  }

  throw new Error(
    "unsupported solve solver; use `hermes` or `openclaw` for direct notebook work, or `skydiscover` for the search path",
  );
};

const parseTimeoutSeconds = (value: number | null | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return 600;
};

const commandForSolver = (
  invocation: SolveSolverInvocation,
): { command: string; args: string[] } => {
  if (invocation.solver === "skydiscover") {
    return {
      command: "uv",
      args: ["run", "python", "-m", "skydiscover"],
    };
  }

  if (invocation.solver === "hermes") {
    return {
      command: invocation.entrypoint,
      args: ["chat", "--toolsets", "skills", "-q", invocation.prompt],
    };
  }

  return {
    command: invocation.entrypoint,
    args: [
      "agent",
      "--local",
      "--json",
      "--timeout",
      String(invocation.timeoutSeconds),
      "--message",
      invocation.prompt,
    ],
  };
};

const defaultRunSolver = async (invocation: SolveSolverInvocation): Promise<SolveSolverResult> => {
  await ensureDir(path.dirname(invocation.logPath));
  const logHandle = await fs.open(invocation.logPath, "a");
  const { command, args } = commandForSolver(invocation);

  return new Promise<SolveSolverResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: invocation.workspacePath,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, invocation.timeoutSeconds * 1000);

    const append = async (prefix: string, chunk: Buffer | string): Promise<void> => {
      const body = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (body.length === 0) {
        return;
      }

      await logHandle.appendFile(`${prefix}${body}`);
    };

    child.stdout?.on("data", (chunk) => {
      void append("", chunk);
    });
    child.stderr?.on("data", (chunk) => {
      void append("[stderr] ", chunk);
    });

    child.on("error", async (error) => {
      clearTimeout(timer);
      await logHandle.close();
      reject(
        new Error(
          `unable to start ${invocation.solver} solve adapter \`${invocation.entrypoint}\`: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    });

    child.on("close", async (code) => {
      clearTimeout(timer);
      await logHandle.close();
      resolve({ exitCode: code ?? 1 });
    });
  });
};

const extractMetric = (metrics: Record<string, unknown>, key: string): number | null => {
  const value = metrics[key];
  return typeof value === "number" ? value : null;
};

const readVerdictSummary = async (workspacePath: string): Promise<BbhRunSolveVerdictSummary> => {
  const verdictPath = path.join(workspacePath, "outputs", "verdict.json");
  if (!(await fileExists(verdictPath))) {
    throw new Error("missing required solver output: outputs/verdict.json");
  }

  let verdict: Record<string, unknown>;
  try {
    verdict = await readJsonFile<Record<string, unknown>>(verdictPath);
  } catch {
    throw new Error("invalid verdict output: outputs/verdict.json must be valid JSON");
  }

  const decision = verdict.decision;
  const justification = verdict.justification;
  const metrics = verdict.metrics;

  if (typeof decision !== "string" || decision.trim() === "") {
    throw new Error("invalid verdict output: decision must be a non-empty string");
  }

  if (typeof justification !== "string" || justification.trim() === "") {
    throw new Error("invalid verdict output: justification must be a non-empty string");
  }

  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    throw new Error("invalid verdict output: metrics must be an object");
  }

  return {
    decision,
    raw_score: extractMetric(metrics as Record<string, unknown>, "raw_score"),
    normalized_score: extractMetric(metrics as Record<string, unknown>, "normalized_score"),
  };
};

const validateSolveOutputs = async (workspacePath: string): Promise<BbhRunSolveVerdictSummary> => {
  const finalAnswer = await readRequiredTextFile(path.join(workspacePath, "final_answer.md"));
  if (finalAnswer.trim() === "") {
    throw new Error("missing required solver output: final_answer.md");
  }

  const runSource = await readJsonFile<BbhRunSource>(path.join(workspacePath, "run.source.yaml"));
  const searchSummaryPath = path.join(
    workspacePath,
    runSource.paths?.search_summary_path ?? "outputs/skydiscover/search_summary.json",
  );
  if (!(await fileExists(searchSummaryPath))) {
    throw new Error("missing required solver output: outputs/skydiscover/search_summary.json");
  }
  try {
    await readJsonFile<Record<string, unknown>>(searchSummaryPath);
  } catch {
    throw new Error("invalid solver output: outputs/skydiscover/search_summary.json must be valid JSON");
  }

  return readVerdictSummary(workspacePath);
};

const updateRunSourceForSolve = (
  runSource: BbhRunSource,
  solver: SupportedSolveSolver,
  entrypoint: string,
  verdictSummary: BbhRunSolveVerdictSummary,
  searchSummary: Record<string, unknown>,
): BbhRunSource => {
  const nextRunSource: BbhRunSource = {
    ...runSource,
    solver: {
      kind: solver,
      entrypoint,
    },
    status: "completed",
    score: {
      raw: verdictSummary.raw_score ?? 0,
      normalized: verdictSummary.normalized_score ?? 0,
      scorer_version: runSource.evaluator.scorer_version,
    },
  };

  if (solver === "skydiscover") {
    nextRunSource.search = {
      algorithm: solver,
      budget: runSource.search?.budget ?? null,
      checkpoint_ref: runSource.search?.checkpoint_ref ?? null,
      summary: searchSummary as NonNullable<NonNullable<BbhRunSource["search"]>["summary"]>,
    };
  } else {
    delete nextRunSource.search;
  }

  return nextRunSource;
};

const syncRunMetadata = async (
  workspacePath: string,
  solver: SupportedSolveSolver,
  entrypoint: string,
  verdictSummary: BbhRunSolveVerdictSummary,
): Promise<void> => {
  const runSourcePath = path.join(workspacePath, "run.source.yaml");
  const runSource = await readJsonFile<BbhRunSource>(runSourcePath);
  const searchConfigPath = path.join(workspacePath, runSource.paths?.search_config_path ?? "search.config.yaml");
  const searchSummaryPath = path.join(
    workspacePath,
    runSource.paths?.search_summary_path ?? "outputs/skydiscover/search_summary.json",
  );
  const searchSummary = await readJsonFile<Record<string, unknown>>(searchSummaryPath);

  // Keep the run record aligned with the actual local solve path so submit,
  // validate, and public run detail all describe the same BBH/SkyDiscover/Hypotest story.
  const nextRunSource = updateRunSourceForSolve(runSource, solver, entrypoint, verdictSummary, searchSummary);
  const nextSearchConfig = {
    schema_version: "techtree.bbh.search-config.v1",
    solver: nextRunSource.solver,
    search:
      solver === "skydiscover"
        ? nextRunSource.search ?? { algorithm: solver, checkpoint_ref: null, summary: searchSummary }
        : { algorithm: solver, checkpoint_ref: null, summary: searchSummary },
    evaluator: nextRunSource.evaluator,
  };

  await Promise.all([
    fs.writeFile(runSourcePath, `${JSON.stringify(nextRunSource, null, 2)}\n`, "utf8"),
    fs.writeFile(searchConfigPath, `${JSON.stringify(nextSearchConfig, null, 2)}\n`, "utf8"),
  ]);
};

const resolveEntrypoint = (
  config: RegentConfig,
  solver: Exclude<SupportedSolveSolver, "skydiscover">,
  metadata: RegentResolvedRunMetadata,
): string => {
  if (metadata.executor_harness.kind === solver && typeof metadata.executor_harness.entrypoint === "string") {
    return metadata.executor_harness.entrypoint;
  }

  const configured = config.agents.harnesses[solver]?.entrypoint;
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured;
  }

  throw new Error(`solve adapter is not configured for ${solver}`);
};

export async function solveBbhWorkspace(
  config: RegentConfig,
  params: BbhRunSolveParams,
  metadata: RegentResolvedRunMetadata,
  options: SolveOptions = {},
): Promise<BbhRunSolveResponse> {
  const workspacePath = path.resolve(params.workspace_path);
  await ensureRequiredInputs(workspacePath);

  const targetProtectedBefore = await snapshotProtectedFiles(workspacePath);
  const solver = parseSupportedSolver(params.solver);
  const harnessWorkspaceRoot =
    solver === "skydiscover" ? config.workloads.bbh.workspaceRoot : config.agents.harnesses[solver]?.workspaceRoot;
  if (!harnessWorkspaceRoot) {
    throw new Error(`missing workspace root for ${solver} solve adapter`);
  }

  const isolatedWorkspacePath = path.join(
    harnessWorkspaceRoot,
    "bbh-solve",
    `${path.basename(workspacePath)}-${shortHash({ workspacePath, solver, at: nowIso() })}`,
  );

  await copyWorkspace(workspacePath, isolatedWorkspacePath);
  const isolatedProtectedBefore = await snapshotProtectedFiles(isolatedWorkspacePath);
  const logPath = path.join(isolatedWorkspacePath, "outputs", "run.log");
  const timeoutSeconds = parseTimeoutSeconds(params.timeout_seconds);

  const runner = options.runSolver ?? defaultRunSolver;
  const prompt = buildSolvePrompt(workspacePath, metadata);
  const invocation: SolveSolverInvocation = {
    solver,
    entrypoint:
      solver === "skydiscover" ? "uv" : resolveEntrypoint(config, solver, metadata),
    workspacePath: isolatedWorkspacePath,
    prompt,
    timeoutSeconds,
    logPath,
  };

  const result = await runner(invocation);
  if (result.exitCode !== 0) {
    await syncFileIfPresent(logPath, path.join(workspacePath, "outputs", "run.log"));
    throw new Error(`${solver} solve adapter exited with code ${result.exitCode}`);
  }

  const isolatedProtectedAfter = await snapshotProtectedFiles(isolatedWorkspacePath);
  assertSnapshotsMatch(
    isolatedProtectedBefore,
    isolatedProtectedAfter,
    "solver modified protected workspace inputs",
  );

  const verdictSummary = await validateSolveOutputs(isolatedWorkspacePath);
  const producedFiles = await syncOutputsBack(isolatedWorkspacePath, workspacePath);

  const targetProtectedAfter = await snapshotProtectedFiles(workspacePath);
  assertSnapshotsMatch(
    targetProtectedBefore,
    targetProtectedAfter,
    "solver modified protected workspace inputs",
  );

  await syncRunMetadata(workspacePath, solver, invocation.entrypoint, verdictSummary);
  const syncedFiles = [...producedFiles, "run.source.yaml", "search.config.yaml"];

  return {
    ok: true,
    entrypoint: "bbh.run.solve",
    workspace_path: workspacePath,
    run_id: path.basename(workspacePath),
    solver,
    produced_files: syncedFiles,
    verdict_summary: verdictSummary,
  };
}
