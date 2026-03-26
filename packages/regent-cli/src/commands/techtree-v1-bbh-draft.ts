import type { ParsedCliArgs } from "../parse.js";

import { daemonCall } from "../daemon-client.js";
import { getFlag, requireArg } from "../parse.js";
import { printJson } from "../printer.js";
import { normalizeWorkspacePath } from "./techtree-v1-shared.js";

const parseParentId = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("invalid parent id");
  }

  return parsed;
};

export async function runTechtreeBbhDraftInit(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.init",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftCreate(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const title = requireArg(getFlag(args, "title"), "title");
  const seed = getFlag(args, "seed");
  const parentId = parseParentId(getFlag(args, "parent-id"));

  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.create",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
        title,
        ...(seed ? { seed } : {}),
        ...(parentId ? { parent_id: parentId } : {}),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftList(configPath?: string): Promise<void> {
  printJson(await daemonCall("techtree.v1.bbh.draft.list", undefined, configPath));
}

export async function runTechtreeBbhDraftPull(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.pull",
      {
        capsule_id: requireArg(getFlag(args, "capsule-id") ?? args.positionals[4], "capsule id"),
        workspace_path: normalizeWorkspacePath(args, 5),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftPropose(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.propose",
      {
        workspace_path: normalizeWorkspacePath(args, 4),
        capsule_id: requireArg(getFlag(args, "capsule-id"), "capsule id"),
        summary: requireArg(getFlag(args, "summary"), "summary"),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftProposals(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.proposals",
      {
        capsule_id: requireArg(getFlag(args, "capsule-id") ?? args.positionals[4], "capsule id"),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftApply(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.apply",
      {
        capsule_id: requireArg(getFlag(args, "capsule-id") ?? args.positionals[4], "capsule id"),
        proposal_id: requireArg(getFlag(args, "proposal-id") ?? args.positionals[5], "proposal id"),
      },
      configPath,
    ),
  );
}

export async function runTechtreeBbhDraftReady(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.bbh.draft.ready",
      {
        capsule_id: requireArg(getFlag(args, "capsule-id") ?? args.positionals[4], "capsule id"),
      },
      configPath,
    ),
  );
}
