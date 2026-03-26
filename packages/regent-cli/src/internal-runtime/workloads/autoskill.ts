import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
};

const shortHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

const sha256Hex = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const ensureDir = async (targetPath: string): Promise<void> => {
  await fs.mkdir(targetPath, { recursive: true });
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readOptionalText = async (targetPath: string): Promise<string | null> => {
  if (!(await fileExists(targetPath))) {
    return null;
  }

  return fs.readFile(targetPath, "utf8");
};

const readOptionalJson = async (targetPath: string): Promise<Record<string, unknown>> => {
  if (!(await fileExists(targetPath))) {
    return {};
  }

  return JSON.parse(await fs.readFile(targetPath, "utf8")) as Record<string, unknown>;
};

const DEFAULT_SKILL_MANIFEST = `type: skill
access_mode: public_free
marimo_entrypoint: session.marimo.py
metadata:
  version: 0.1.0
`;

const DEFAULT_EVAL_MANIFEST = `type: eval
access_mode: public_free
marimo_entrypoint: session.marimo.py
metadata:
  version: 0.1.0
`;

const DEFAULT_SKILL_MARIMO = `import marimo as mo
app = mo.App()

@app.cell
def _():
    # Interactive "try this skill" surface for this bundle.
    return

if __name__ == "__main__":
    app.run()
`;

const DEFAULT_EVAL_MARIMO = `import marimo as mo
app = mo.App()

@app.cell
def _():
    # Interactive eval dashboard and grader inspection surface.
    return

if __name__ == "__main__":
    app.run()
`;

const DEFAULT_RESULT = {
  runtime_kind: "local",
  status: "complete",
  trial_count: 1,
  raw_score: 0,
  normalized_score: 0,
  grader_breakdown: {},
};

const parseManifestText = (source: string): Record<string, unknown> => {
  const lines = source.split(/\r?\n/);
  const root: Record<string, unknown> = {};
  let currentSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const [rawKey, ...rawValueParts] = trimmed.split(":");
    const key = rawKey?.trim();
    const valueText = rawValueParts.join(":").trim();

    if (!key) {
      continue;
    }

    if (indent === 0) {
      if (valueText === "") {
        currentSection = key;
        root[key] = {};
      } else {
        currentSection = null;
        root[key] = valueText;
      }

      continue;
    }

    if (currentSection) {
      const section = root[currentSection];
      if (section && typeof section === "object" && !Array.isArray(section)) {
        (section as Record<string, unknown>)[key] = valueText;
      }
    }
  }

  return root;
};

const listWorkspaceFiles = async (workspacePath: string): Promise<string[]> => {
  const entries: string[] = [];

  const walk = async (relativePath: string): Promise<void> => {
    const absolutePath = path.join(workspacePath, relativePath);
    const stat = await fs.stat(absolutePath);

    if (stat.isDirectory()) {
      const name = path.basename(absolutePath);
      if ([".git", "node_modules", "dist"].includes(name)) {
        return;
      }

      const children = await fs.readdir(absolutePath);
      for (const child of children.sort()) {
        await walk(path.join(relativePath, child));
      }
      return;
    }

    entries.push(relativePath.split(path.sep).join("/"));
  };

  await walk(".");

  return entries
    .filter((entry) => entry !== ".")
    .map((entry) => entry.replace(/^\.\//, ""))
    .sort();
};

export interface AutoskillBundleBuildResult {
  archiveBase64: string;
  archiveHash: string;
  manifest: Record<string, unknown>;
  marimoEntrypoint: string;
  primaryFile: string | null;
  previewMd: string | null;
}

export const initAutoskillSkillWorkspace = async (workspacePath: string): Promise<string[]> => {
  const resolved = path.resolve(workspacePath);
  await ensureDir(resolved);
  await ensureDir(path.join(resolved, "prompts"));
  await ensureDir(path.join(resolved, "examples"));
  await fs.writeFile(path.join(resolved, "manifest.yaml"), DEFAULT_SKILL_MANIFEST, "utf8");
  await fs.writeFile(path.join(resolved, "session.marimo.py"), DEFAULT_SKILL_MARIMO, "utf8");
  await fs.writeFile(path.join(resolved, "SKILL.md"), "# Skill\n\nDescribe the skill preview here.\n", "utf8");

  return ["manifest.yaml", "session.marimo.py", "SKILL.md", "prompts/", "examples/"];
};

export const initAutoskillEvalWorkspace = async (workspacePath: string): Promise<string[]> => {
  const resolved = path.resolve(workspacePath);
  await ensureDir(resolved);
  await ensureDir(path.join(resolved, "tasks"));
  await ensureDir(path.join(resolved, "graders"));
  await ensureDir(path.join(resolved, "fixtures"));
  await fs.writeFile(path.join(resolved, "scenario.yaml"), DEFAULT_EVAL_MANIFEST, "utf8");
  await fs.writeFile(path.join(resolved, "session.marimo.py"), DEFAULT_EVAL_MARIMO, "utf8");
  await fs.writeFile(path.join(resolved, "README.md"), "# Eval\n\nDescribe the eval scenario preview here.\n", "utf8");

  return ["scenario.yaml", "session.marimo.py", "README.md", "tasks/", "graders/", "fixtures/"];
};

export const buildAutoskillBundlePayload = async (
  workspacePath: string,
  kind: "skill" | "eval",
  overrides?: {
    accessMode?: "public_free" | "gated_paid";
    marimoEntrypoint?: string;
    primaryFile?: string | null;
    version?: string;
    previewMd?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<AutoskillBundleBuildResult> => {
  const resolved = path.resolve(workspacePath);
  const manifestPath = path.join(resolved, kind === "skill" ? "manifest.yaml" : "scenario.yaml");
  const manifestText = (await readOptionalText(manifestPath)) ?? "";
  const parsedManifest = parseManifestText(manifestText);
  const metadataFromFile =
    parsedManifest.metadata && typeof parsedManifest.metadata === "object" && !Array.isArray(parsedManifest.metadata)
      ? (parsedManifest.metadata as Record<string, unknown>)
      : {};
  const marimoEntrypoint =
    overrides?.marimoEntrypoint ??
    (typeof parsedManifest.marimo_entrypoint === "string" ? parsedManifest.marimo_entrypoint : "session.marimo.py");

  if (!(await fileExists(path.join(resolved, marimoEntrypoint)))) {
    throw new Error(`missing required marimo entrypoint: ${marimoEntrypoint}`);
  }

  const primaryFile =
    overrides?.primaryFile === undefined
      ? kind === "skill"
        ? "SKILL.md"
        : "scenario.yaml"
      : overrides.primaryFile;

  const previewMd =
    overrides?.previewMd ??
    (kind === "skill"
      ? await readOptionalText(path.join(resolved, "SKILL.md"))
      : (await readOptionalText(path.join(resolved, "README.md"))) ?? manifestText);

  const files = await listWorkspaceFiles(resolved);
  const encodedFiles = await Promise.all(
    files.map(async (relativePath) => {
      const bytes = await fs.readFile(path.join(resolved, relativePath));
      return {
        path: relativePath,
        sha256: sha256Hex(bytes),
        size: bytes.byteLength,
        content_b64: bytes.toString("base64"),
      };
    }),
  );

  const manifest = {
    type: kind,
    access_mode:
      overrides?.accessMode ??
      ((typeof parsedManifest.access_mode === "string" ? parsedManifest.access_mode : "public_free") as
        | "public_free"
        | "gated_paid"),
    marimo_entrypoint: marimoEntrypoint,
    primary_file: primaryFile,
    metadata: {
      ...metadataFromFile,
      ...(overrides?.metadata ?? {}),
      ...(kind === "eval"
        ? { version: overrides?.version ?? String(metadataFromFile.version ?? "0.1.0") }
        : {}),
    },
    files: encodedFiles.map((entry) => ({
      path: entry.path,
      sha256: entry.sha256,
      size: entry.size,
    })),
  };

  const bundleDocument = {
    schema_version: "techtree.autoskill.bundle.v1",
    manifest,
    files: encodedFiles,
  };

  const serialized = stableStringify(bundleDocument);

  return {
    archiveBase64: Buffer.from(serialized, "utf8").toString("base64"),
    archiveHash: sha256Hex(serialized),
    manifest: manifest as Record<string, unknown>,
    marimoEntrypoint,
    primaryFile,
    previewMd,
  };
};

export const loadAutoskillResultPayload = async (
  workspacePath: string,
): Promise<Record<string, unknown>> => {
  const resolved = path.resolve(workspacePath);
  const result = { ...DEFAULT_RESULT, ...(await readOptionalJson(path.join(resolved, "result.json"))) };
  const artifacts = await readOptionalJson(path.join(resolved, "artifacts.json"));
  const reproManifest = await readOptionalJson(path.join(resolved, "repro-manifest.json"));

  return {
    ...result,
    artifacts,
    repro_manifest: reproManifest,
  };
};

export const materializeAutoskillBundle = async (
  workspacePath: string,
  bundleText: string,
): Promise<string[]> => {
  const resolved = path.resolve(workspacePath);
  await ensureDir(resolved);

  const parsed = JSON.parse(bundleText) as {
    files?: Array<{ path: string; content_b64: string }>;
  };

  if (!Array.isArray(parsed.files)) {
    throw new Error("invalid autoskill bundle payload");
  }

  const written: string[] = [];

  for (const file of parsed.files) {
    if (!file?.path || !file.content_b64) {
      continue;
    }

    const targetPath = path.join(resolved, file.path);
    await ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, Buffer.from(file.content_b64, "base64"));
    written.push(file.path);
  }

  return written.sort();
};

export const defaultSkillSlug = (workspacePath: string): string =>
  path.basename(path.resolve(workspacePath)).toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const defaultTitle = (workspacePath: string): string => {
  const base = path.basename(path.resolve(workspacePath)).replace(/[-_]+/g, " ").trim();
  return base ? `${base[0]!.toUpperCase()}${base.slice(1)}` : "Autoskill bundle";
};

export const defaultVersion = (workspacePath: string): string =>
  `0.1.${Number.parseInt(shortHash(path.resolve(workspacePath)).slice(0, 2), 16) % 1000}`;

export const writeDefaultResultFiles = async (workspacePath: string): Promise<void> => {
  const resolved = path.resolve(workspacePath);
  await fs.writeFile(path.join(resolved, "result.json"), jsonText(DEFAULT_RESULT), "utf8");
  await fs.writeFile(path.join(resolved, "artifacts.json"), jsonText({}), "utf8");
  await fs.writeFile(path.join(resolved, "repro-manifest.json"), jsonText({}), "utf8");
};
