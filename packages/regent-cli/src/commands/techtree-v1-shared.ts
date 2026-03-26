import path from "node:path";

import type { TechtreeNodeId, TechtreeTreeName } from "../internal-types/index.js";

import { getFlag, requireArg, type ParsedCliArgs } from "../parse.js";

export const normalizeTree = (value: string): TechtreeTreeName => {
  if (value === "main" || value === "bbh") {
    return value;
  }

  throw new Error("invalid tree; expected `main` or `bbh`");
};

export const workspaceFlag = (args: ParsedCliArgs): string | undefined => getFlag(args, "workspace") ?? getFlag(args, "path");

export const normalizeWorkspacePath = (args: ParsedCliArgs, fallbackIndex: number): string => {
  const explicit = workspaceFlag(args);
  if (explicit) {
    return path.resolve(explicit);
  }

  const positional = args.positionals[fallbackIndex];
  return positional ? path.resolve(positional) : process.cwd();
};

export const optionalWorkspacePath = (args: ParsedCliArgs): string | null => workspaceFlag(args) ?? null;

export const normalizeNodeId = (value: string | undefined, name = "node id"): TechtreeNodeId => {
  const required = requireArg(value, name);
  if (!/^0x[0-9a-f]{64}$/.test(required)) {
    throw new Error(`invalid ${name}`);
  }

  return required as TechtreeNodeId;
};

export const readRepeatedFlag = (args: ParsedCliArgs, name: string): string[] => {
  const values: string[] = [];

  for (let index = 0; index < args.raw.length; index += 1) {
    const current = args.raw[index];
    if (current === `--${name}`) {
      const next = args.raw[index + 1];
      if (next && !next.startsWith("--")) {
        values.push(next);
      }
      continue;
    }

    if (current.startsWith(`--${name}=`)) {
      values.push(current.slice(name.length + 3));
    }
  }

  return values;
};

export const parseCsvFlag = (args: ParsedCliArgs, name: string): string[] => {
  const repeated = readRepeatedFlag(args, name);
  if (repeated.length > 0) {
    return repeated.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
  }

  const single = getFlag(args, name);
  if (!single) {
    return [];
  }

  return single.split(",").map((value) => value.trim()).filter(Boolean);
};
