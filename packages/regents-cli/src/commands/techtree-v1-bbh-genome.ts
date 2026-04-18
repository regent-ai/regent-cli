import type { ParsedCliArgs } from "../parse.js";

import { daemonCall } from "../daemon-client.js";
import { getFlag, parseIntegerFlag, requireArg } from "../parse.js";
import { printJson } from "../printer.js";
import { readBbhGenome, readRunMetadata } from "./techtree-v1.js";
import { normalizeWorkspacePath } from "./techtree-v1-shared.js";

const readCapsuleIds = (args: ParsedCliArgs): string[] | undefined => {
  const value = getFlag(args, "capsule-ids");
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
};

export async function runTechtreeBbhGenomeInit(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const metadata = readRunMetadata(args);
  const genome = readBbhGenome(args);
  const lane = getFlag(args, "lane");
  const sampleSize = parseIntegerFlag(args, "sample-size");
  const budget = parseIntegerFlag(args, "budget");
  const capsuleIds = readCapsuleIds(args);

  printJson(
    await daemonCall(
      "techtree.v1.bbh.genome.init",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
        ...(metadata ? { metadata } : {}),
        ...(genome ? { genome } : {}),
        ...(lane ? { split: lane as "climb" | "benchmark" | "challenge" } : {}),
        ...(sampleSize ? { sample_size: sampleSize } : {}),
        ...(budget ? { budget } : {}),
        ...(capsuleIds && capsuleIds.length > 0 ? { capsule_ids: capsuleIds } : {}),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhGenomeScore(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const metadata = readRunMetadata(args);

  printJson(
    await daemonCall(
      "techtree.v1.bbh.genome.score",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
        ...(metadata ? { metadata } : {}),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhGenomeImprove(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const metadata = readRunMetadata(args);

  printJson(
    await daemonCall(
      "techtree.v1.bbh.genome.improve",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
        ...(metadata ? { metadata } : {}),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhGenomePropose(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const capsuleId = requireArg(getFlag(args, "capsule-id") ?? args.positionals[4], "capsule id");
  const summary = getFlag(args, "summary");

  printJson(
    await daemonCall(
      "techtree.v1.bbh.genome.propose",
      {
        workspace_path: normalizeWorkspacePath(args, 5),
        capsule_id: capsuleId,
        ...(summary ? { summary } : {}),
      },
      configPath,
    ),
  );
}
