import { writeOpenClawRegentsWorkSkill } from "../../agents/openclaw/connect.js";
import { loadConfig } from "../../internal-runtime/index.js";
import { getFlag, requireArg, type ParsedCliArgs } from "../../parse.js";
import {
  printAgentConnectHermesResult,
  printAgentConnectOpenClawResult,
  printAgentExecutionPoolResult,
  printAgentLinkResult,
} from "../rwr-presenters.js";
import { buildAgentAuthHeaders } from "../agent-auth.js";
import {
  loadResolvedPlatformSession,
  requestPlatformSessionJson,
} from "../platform.js";

type JsonObject = Record<string, unknown>;

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/u, "");

const companyId = (args: ParsedCliArgs): string => requireArg(getFlag(args, "company-id"), "company-id");

const relationshipMember = (
  args: ParsedCliArgs,
  input: { agentFlag: string; workerFlag: string; label: string },
): { agentId?: string; workerId?: string; routeId: string } => {
  const agentId = getFlag(args, input.agentFlag);
  const workerId = getFlag(args, input.workerFlag);

  if (agentId && workerId) {
    throw new Error(`use either --${input.agentFlag} or --${input.workerFlag} for the ${input.label}, not both`);
  }

  if (!agentId && !workerId) {
    throw new Error(`missing ${input.label}: pass --${input.agentFlag} or --${input.workerFlag}`);
  }

  return {
    ...(agentId ? { agentId } : {}),
    ...(workerId ? { workerId } : {}),
    routeId: agentId ?? workerId ?? "",
  };
};

const writeSkillEnabled = (args: ParsedCliArgs): boolean => {
  const value = getFlag(args, "write-skill");
  return value === undefined || value === "true" || value === "1" || value === "yes";
};

const registeredWorkerId = (data: JsonObject): string => {
  const worker = data.worker;

  if (!worker || typeof worker !== "object" || Array.isArray(worker)) {
    throw new Error("Platform did not return a connected worker.");
  }

  const id = (worker as JsonObject).id;

  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error("Platform did not return a worker id.");
  }

  return String(id);
};

const requestAgentPlatformJson = async (
  configPath: string | undefined,
  input: { method: "GET" | "POST"; path: string; body?: JsonObject },
): Promise<{ origin: string; data: JsonObject }> => {
  const origin = normalizeOrigin(loadConfig(configPath).auth.baseUrl);
  const serializedBody = input.body === undefined ? undefined : JSON.stringify(input.body);
  const authHeaders = await buildAgentAuthHeaders({
    method: input.method,
    path: input.path,
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
    configPath,
    audience: "platform",
  });
  const response = await fetch(`${origin}${input.path}`, {
    method: input.method,
    headers: {
      accept: "application/json",
      ...(serializedBody === undefined ? {} : { "content-type": "application/json" }),
      ...authHeaders,
    },
    ...(serializedBody === undefined ? {} : { body: serializedBody }),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, response.status));
  }

  return { origin, data };
};

export async function runAgentConnectHermes(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const role = requireArg(getFlag(args, "role"), "role");
  const displayName = getFlag(args, "name") ?? null;
  const { origin, data } = await requestAgentPlatformJson(configPath, {
    method: "POST",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/workers`,
    body: {
      company_id: resolvedCompanyId,
      agent_kind: "hermes",
      worker_role: role,
      execution_surface: role === "manager" ? "hosted_sprite" : "local_bridge",
      runner_kind: role === "manager" ? "hermes_hosted_manager" : "hermes_local_manager",
      billing_mode: role === "manager" ? "platform_hosted" : "user_local",
      trust_scope: role === "manager" ? "platform_hosted" : "local_user_controlled",
      reported_usage_policy: role === "manager" ? "platform_metered" : "self_reported",
      display_name: displayName,
      endpoint_url: null,
    },
  });

  printAgentConnectHermesResult(args, { ok: true, command: "regents agent connect hermes", origin, result: data });
}

export async function runAgentConnectOpenClaw(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const role = requireArg(getFlag(args, "role"), "role");
  const displayName = getFlag(args, "name") ?? "OpenClaw local worker";
  const runnerKind = role === "manager" ? "openclaw_local_manager" : "openclaw_local_executor";
  const { origin, data } = await requestAgentPlatformJson(configPath, {
    method: "POST",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/workers`,
    body: {
      company_id: resolvedCompanyId,
      agent_kind: "openclaw",
      worker_role: role,
      execution_surface: "local_bridge",
      runner_kind: runnerKind,
      billing_mode: "user_local",
      trust_scope: "local_user_controlled",
      reported_usage_policy: "self_reported",
      display_name: displayName,
      endpoint_url: null,
    },
  });
  const skill = writeSkillEnabled(args)
    ? await writeOpenClawRegentsWorkSkill({
        companyId: resolvedCompanyId,
        workerId: registeredWorkerId(data),
        workerName: displayName,
      })
    : null;

  printAgentConnectOpenClawResult(args, {
    ok: true,
    command: "regents agent connect openclaw",
    origin,
    result: data,
    openclaw: {
      skillFile: skill?.skillPath ?? null,
    },
  });
}

export async function runAgentLink(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const manager = relationshipMember(args, {
    agentFlag: "manager-agent-id",
    workerFlag: "manager-worker-id",
    label: "manager",
  });
  const executor = relationshipMember(args, {
    agentFlag: "executor-agent-id",
    workerFlag: "executor-worker-id",
    label: "executor",
  });
  const relationship = requireArg(getFlag(args, "relationship"), "relationship");
  const { origin, session } = await loadResolvedPlatformSession(args);
  const { data } = await requestPlatformSessionJson({
    origin,
    session,
    method: "POST",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/agents/${encodeURIComponent(manager.routeId)}/relationships`,
    body: {
      company_id: resolvedCompanyId,
      ...(manager.agentId ? { source_agent_profile_id: manager.agentId } : {}),
      ...(manager.workerId ? { source_worker_id: manager.workerId } : {}),
      ...(executor.agentId ? { target_agent_profile_id: executor.agentId } : {}),
      ...(executor.workerId ? { target_worker_id: executor.workerId } : {}),
      relationship_kind: relationship,
      status: "active",
    },
  });

  printAgentLinkResult(args, { ok: true, command: "regents agent link", origin, result: data });
}

export async function runAgentExecutionPool(args: ParsedCliArgs): Promise<void> {
  const resolvedCompanyId = companyId(args);
  const manager = requireArg(getFlag(args, "manager"), "manager");
  const { origin, session } = await loadResolvedPlatformSession(args);
  const { data } = await requestPlatformSessionJson({
    origin,
    session,
    method: "GET",
    path: `/api/agent-platform/companies/${encodeURIComponent(resolvedCompanyId)}/rwr/agents/${encodeURIComponent(manager)}/execution-pool`,
  });

  printAgentExecutionPoolResult(args, { ok: true, command: "regents agent execution-pool", origin, result: data });
}

const parseJsonResponse = async (response: Response): Promise<JsonObject> => {
  const text = await response.text();
  if (text === "") {
    return {};
  }

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Platform returned a non-object response with status ${response.status}.`);
  }

  return parsed as JsonObject;
};

const extractErrorMessage = (data: JsonObject, status: number): string => {
  for (const key of ["statusMessage", "message", "error"]) {
    const value = data[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
  }

  return `Platform request failed with status ${status}.`;
};
