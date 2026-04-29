import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");

const targets = [
  {
    input: resolve(root, "../platform/api-contract.openapiv3.yaml"),
    output: resolve(root, "packages/regents-cli/src/generated/platform-openapi.ts"),
  },
  {
    input: resolve(root, "../techtree/docs/api-contract.openapiv3.yaml"),
    output: resolve(root, "packages/regents-cli/src/generated/techtree-openapi.ts"),
  },
  {
    input: resolve(root, "../autolaunch/docs/api-contract.openapiv3.yaml"),
    output: resolve(root, "packages/regents-cli/src/generated/autolaunch-openapi.ts"),
  },
  {
    input: resolve(root, "docs/regent-services-contract.openapiv3.yaml"),
    output: resolve(root, "packages/regents-cli/src/generated/regent-services-openapi.ts"),
  },
];

for (const target of targets) {
  if (!existsSync(target.input) || !statSync(target.input).isFile()) {
    console.error(`Missing OpenAPI contract input: ${target.input}`);
    console.error("Check out the sibling contract repositories, then rerun OpenAPI generation.");
    process.exit(1);
  }

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
