import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const sourceContractPath = resolve(root, "docs/regent-services-contract.openapiv3.yaml");
const servedContractPath = resolve(
  root,
  "../siwa-server/priv/static/regent-services-contract.openapiv3.yaml",
);
const generatedContractPath = resolve(
  root,
  "packages/regents-cli/src/generated/regent-services-openapi.ts",
);

const read = (path) => readFileSync(path);
const readText = (path) => readFileSync(path, "utf8");
const sameFile = (left, right) => read(left).equals(read(right));
const failures = [];
const requiredFiles = [
  ["source shared services contract", sourceContractPath],
  ["served SIWA shared services contract", servedContractPath],
  ["generated shared services OpenAPI types", generatedContractPath],
];

for (const [label, path] of requiredFiles) {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) {
      failures.push(`missing ${label}: ${path}`);
    }
  } catch {
    failures.push(`missing ${label}: ${path}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const stable = (value) => {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)]),
    );
  }

  return value;
};

const sameValue = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const sourceContract = YAML.parse(readText(sourceContractPath));
const servedContract = YAML.parse(readText(servedContractPath));
const sourcePaths = sourceContract.paths ?? {};
const servedPaths = servedContract.paths ?? {};

for (const [servedPath, servedMethods] of Object.entries(servedPaths)) {
  const sourceMethods = sourcePaths[servedPath];

  if (!sourceMethods) {
    failures.push(`SIWA serves ${servedPath}, but it is missing from ${sourceContractPath}`);
    continue;
  }

  if (!sameValue(servedMethods, sourceMethods)) {
    failures.push(
      [
        `SIWA served contract drifted for ${servedPath}`,
        `source: ${sourceContractPath}`,
        `served: ${servedContractPath}`,
      ].join("\n"),
    );
  }
}

const servedTagNames = new Set((servedContract.tags ?? []).map((tag) => tag?.name).filter(Boolean));
const sourceTagNames = new Set((sourceContract.tags ?? []).map((tag) => tag?.name).filter(Boolean));

for (const tag of servedTagNames) {
  if (!sourceTagNames.has(tag)) {
    failures.push(`SIWA served tag ${tag} is missing from ${sourceContractPath}`);
  }
}

const tempDir = mkdtempSync(join(tmpdir(), "regent-services-openapi-"));
const tempGeneratedPath = join(tempDir, "regent-services-openapi.ts");

try {
  const result = spawnSync(
    "pnpm",
    ["exec", "openapi-typescript", sourceContractPath, "-o", tempGeneratedPath],
    { cwd: root, encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "shared services OpenAPI generation failed\n");
    process.exit(result.status ?? 1);
  }

  if (!sameFile(tempGeneratedPath, generatedContractPath)) {
    failures.push(
      [
        "generated shared services OpenAPI types drifted from the source contract",
        `source: ${sourceContractPath}`,
        `generated: ${generatedContractPath}`,
      ].join("\n"),
    );
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log("shared services contract check passed");
