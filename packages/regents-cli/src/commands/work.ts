import { getFlag, requireArg, type ParsedCliArgs } from "../parse.js";
import {
  printWorkCreateResult,
  printWorkListResult,
  printWorkRunResult,
  printWorkShowResult,
  printWorkWatchResult,
} from "./rwr-presenters.js";
import {
  loadResolvedPlatformSession,
  requestPlatformSessionJson,
} from "./platform.js";

type JsonObject = Record<string, unknown>;

const companyId = (args: ParsedCliArgs): string => requireArg(getFlag(args, "company-id"), "company-id");

const positional = (args: ParsedCliArgs, index: number, name: string): string =>
  requireArg(args.positionals[index], name);

const requestWorkJson = async (
  args: ParsedCliArgs,
  input: { method: "GET" | "POST"; path: string; body?: JsonObject },
): Promise<{ origin: string; data: JsonObject }> => {
  const { origin, session } = await loadResolvedPlatformSession(args);
  const { data } = await requestPlatformSessionJson({
    origin,
    session,
    method: input.method,
    path: input.path,
    ...(input.body === undefined ? {} : { body: input.body }),
  });

  return { origin, data };
};

export async function runWorkCreate(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const title = requireArg(getFlag(args, "title"), "title");
  const description = getFlag(args, "description") ?? null;
  const { origin, data } = await requestWorkJson(args, {
    method: "POST",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/work-items`,
    body: {
      company_id: resolvedCompanyId,
      title,
      description,
    },
  });

  printWorkCreateResult(args, { ok: true, command: "regents work create", origin, result: data });
}

export async function runWorkList(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const { origin, data } = await requestWorkJson(args, {
    method: "GET",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/work-items`,
  });

  printWorkListResult(args, { ok: true, command: "regents work list", origin, result: data });
}

export async function runWorkShow(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const workItemId = positional(args, 2, "work_item_id");
  const { origin, data } = await requestWorkJson(args, {
    method: "GET",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/work-items/${encodeURIComponent(workItemId)}`,
  });

  printWorkShowResult(args, { ok: true, command: "regents work show", origin, result: data });
}

export async function runWorkRun(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const workItemId = positional(args, 2, "work_item_id");
  const runnerKind = requireArg(getFlag(args, "runner"), "runner");
  const workerId = getFlag(args, "worker-id") ?? null;
  const instructions = getFlag(args, "instructions") ?? null;
  const { origin, data } = await requestWorkJson(args, {
    method: "POST",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/work-items/${encodeURIComponent(workItemId)}/runs`,
    body: {
      company_id: resolvedCompanyId,
      work_item_id: workItemId,
      runner_kind: runnerKind,
      worker_id: workerId,
      instructions,
    },
  });

  printWorkRunResult(args, { ok: true, command: "regents work run", origin, result: data });
}

export async function runWorkWatch(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const runId = positional(args, 2, "run_id");
  const { origin, data } = await requestWorkJson(args, {
    method: "GET",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/runs/${encodeURIComponent(runId)}/events`,
  });

  printWorkWatchResult(args, { ok: true, command: "regents work watch", origin, result: data });
}
