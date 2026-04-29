import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  {
    label: "Platform OpenAPI contract",
    path: resolve(root, "../platform/api-contract.openapiv3.yaml"),
  },
  {
    label: "Platform CLI contract",
    path: resolve(root, "../platform/cli-contract.yaml"),
  },
  {
    label: "Techtree OpenAPI contract",
    path: resolve(root, "../techtree/docs/api-contract.openapiv3.yaml"),
  },
  {
    label: "Techtree CLI contract",
    path: resolve(root, "../techtree/docs/cli-contract.yaml"),
  },
  {
    label: "Autolaunch OpenAPI contract",
    path: resolve(root, "../autolaunch/docs/api-contract.openapiv3.yaml"),
  },
  {
    label: "Autolaunch CLI contract",
    path: resolve(root, "../autolaunch/docs/cli-contract.yaml"),
  },
  {
    label: "Regent shared services contract",
    path: resolve(root, "docs/regent-services-contract.openapiv3.yaml"),
  },
  {
    label: "SIWA served shared services contract",
    path: resolve(root, "../siwa-server/priv/static/regent-services-contract.openapiv3.yaml"),
  },
  {
    label: "Shared CLI contract",
    path: resolve(root, "docs/shared-cli-contract.yaml"),
  },
  {
    label: "Generated Platform OpenAPI types",
    path: resolve(root, "packages/regents-cli/src/generated/platform-openapi.ts"),
  },
  {
    label: "Generated Techtree OpenAPI types",
    path: resolve(root, "packages/regents-cli/src/generated/techtree-openapi.ts"),
  },
  {
    label: "Generated Autolaunch OpenAPI types",
    path: resolve(root, "packages/regents-cli/src/generated/autolaunch-openapi.ts"),
  },
  {
    label: "Generated Regent shared services OpenAPI types",
    path: resolve(root, "packages/regents-cli/src/generated/regent-services-openapi.ts"),
  },
];

const missingFiles = requiredFiles.filter(({ path }) => {
  try {
    return !existsSync(path) || !statSync(path).isFile();
  } catch {
    return true;
  }
});

if (missingFiles.length > 0) {
  console.error("Contract checks need these files before they can run:");
  for (const file of missingFiles) {
    console.error(`- ${file.label}: ${file.path}`);
  }
  console.error("");
  console.error("Check out the sibling contract repositories, then rerun the check.");
  process.exit(1);
}

console.log("contract input check passed");
