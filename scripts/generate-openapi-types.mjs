import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const snapshotDir = mkdtempSync(join(tmpdir(), "regent-openapi-"));

const materializeGitSnapshot = ({ repoRoot, ref, repoRelativePath, snapshotName }) => {
  const snapshotPath = resolve(snapshotDir, snapshotName);
  const result = spawnSync("git", ["show", `${ref}:${repoRelativePath}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  writeFileSync(snapshotPath, result.stdout);
  return snapshotPath;
};

const targets = [
  {
    input: materializeGitSnapshot({
      repoRoot: resolve(root, "../techtree"),
      ref: "origin/main",
      repoRelativePath: "docs/api-contract.openapiv3.yaml",
      snapshotName: "techtree-api-contract.openapiv3.yaml",
    }),
    output: resolve(root, "packages/regent-cli/src/generated/techtree-openapi.ts"),
  },
  {
    input: materializeGitSnapshot({
      repoRoot: resolve(root, "../autolaunch"),
      ref: "origin/main",
      repoRelativePath: "docs/api-contract.openapiv3.yaml",
      snapshotName: "autolaunch-api-contract.openapiv3.yaml",
    }),
    output: resolve(root, "packages/regent-cli/src/generated/autolaunch-openapi.ts"),
  },
  {
    input: resolve(root, "docs/regent-services-contract.openapiv3.yaml"),
    output: resolve(root, "packages/regent-cli/src/generated/regent-services-openapi.ts"),
  },
];

try {
  for (const target of targets) {
    mkdirSync(dirname(target.output), { recursive: true });
    const result = spawnSync(
      "pnpm",
      ["exec", "openapi-typescript", target.input, "-o", target.output],
      { cwd: root, stdio: "inherit" },
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
} finally {
  rmSync(snapshotDir, { recursive: true, force: true });
}
