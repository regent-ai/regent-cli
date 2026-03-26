import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildAutoskillBundlePayload,
  initAutoskillEvalWorkspace,
  initAutoskillSkillWorkspace,
  materializeAutoskillBundle,
} from "../../src/internal-runtime/workloads/autoskill.js";

const tempRoots: string[] = [];

const makeTempDir = async (prefix: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((target) => fs.rm(target, { recursive: true, force: true })));
});

describe("autoskill workload helpers", () => {
  it("scaffolds a skill workspace and produces a deterministic bundle payload", async () => {
    const workspace = await makeTempDir("autoskill-skill-");
    await initAutoskillSkillWorkspace(workspace);
    await fs.writeFile(path.join(workspace, "examples", "sample.txt"), "hello\n", "utf8");

    const first = await buildAutoskillBundlePayload(workspace, "skill");
    const second = await buildAutoskillBundlePayload(workspace, "skill");

    expect(first.archiveBase64).toBe(second.archiveBase64);
    expect(first.archiveHash).toBe(second.archiveHash);
    expect(first.marimoEntrypoint).toBe("session.marimo.py");
    expect(first.primaryFile).toBe("SKILL.md");
    expect(first.manifest).toMatchObject({
      type: "skill",
      access_mode: "public_free",
      marimo_entrypoint: "session.marimo.py",
    });
  });

  it("scaffolds an eval workspace and materializes a pulled bundle", async () => {
    const source = await makeTempDir("autoskill-eval-source-");
    const target = await makeTempDir("autoskill-eval-target-");

    await initAutoskillEvalWorkspace(source);
    await fs.writeFile(path.join(source, "tasks", "task.txt"), "score this run\n", "utf8");

    const bundle = await buildAutoskillBundlePayload(source, "eval", {
      version: "0.2.0",
    });

    const restoredFiles = await materializeAutoskillBundle(
      target,
      Buffer.from(bundle.archiveBase64, "base64").toString("utf8"),
    );

    expect(restoredFiles).toContain("session.marimo.py");
    expect(restoredFiles).toContain("scenario.yaml");
    expect(restoredFiles).toContain("tasks/task.txt");
    expect(await fs.readFile(path.join(target, "tasks", "task.txt"), "utf8")).toBe("score this run\n");
  });
});
