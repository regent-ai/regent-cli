import type { ParsedCliArgs } from "../parse.js";

import { daemonCall } from "../daemon-client.js";
import { getFlag, requireArg } from "../parse.js";
import { printJson } from "../printer.js";
import { normalizeWorkspacePath } from "./techtree-v1-shared.js";

const normalizeReviewKind = (value: string): "design" | "genome" | "certification" => {
  if (value === "design" || value === "genome" || value === "certification") {
    return value;
  }

  throw new Error("invalid review kind; expected `design`, `genome`, or `certification`");
};

export async function runTechtreeReviewList(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const kind = getFlag(args, "kind");
  printJson(
    await daemonCall(
      "techtree.v1.review.list",
      kind ? { kind: normalizeReviewKind(kind) } : undefined,
      configPath,
    ),
  );
}

export async function runTechtreeReviewClaim(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.review.claim",
      {
        request_id: requireArg(getFlag(args, "request-id") ?? args.positionals[3], "request id"),
      },
      configPath,
    ),
  );
}

export async function runTechtreeReviewPull(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.review.pull",
      {
        request_id: requireArg(getFlag(args, "request-id") ?? args.positionals[3], "request id"),
        workspace_path: normalizeWorkspacePath(args, 4),
      },
      configPath,
    ),
  );
}

export async function runTechtreeReviewSubmit(args: ParsedCliArgs, configPath?: string): Promise<void> {
  printJson(
    await daemonCall(
      "techtree.v1.review.submit",
      {
        workspace_path: normalizeWorkspacePath(args, 3),
      },
      configPath,
    ),
  );
}
