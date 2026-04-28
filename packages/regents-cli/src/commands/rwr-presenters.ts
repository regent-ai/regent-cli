import {
  CLI_PALETTE,
  isHumanTerminal,
  printJson,
  printText,
  renderKeyValuePanel,
  renderPanel,
  renderTablePanel,
  tone,
  type KeyValueRow,
  type TableRow,
} from "../printer.js";
import { getBooleanFlag, getFlag, type ParsedCliArgs } from "../parse.js";

type JsonObject = Record<string, unknown>;

type RwrPayload = {
  readonly ok: true;
  readonly command: string;
  readonly origin: string;
  readonly result: JsonObject;
};

type RwrOpenClawPayload = RwrPayload & {
  readonly openclaw: {
    readonly skillFile: string | null;
  };
};

const asRecord = (value: unknown, label: string): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Regent returned ${label} that this command cannot show.`);
  }

  return value as JsonObject;
};

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const displayValue = (value: unknown): string | null => {
  if (typeof value === "string" && value !== "") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const idValue = (record: JsonObject): string => {
  const id = displayValue(record.id);
  if (!id) {
    throw new Error("Regent returned a response without a required id.");
  }
  return id;
};

const commandValue = (command: string): string => tone(command, CLI_PALETTE.emphasis, true);

const nextPanel = (lines: readonly string[]): string =>
  renderPanel("◆ NEXT STEP", [...lines], {
    borderColor: CLI_PALETTE.chrome,
    titleColor: CLI_PALETTE.title,
  });

const printRwrPayload = (
  args: ParsedCliArgs,
  payload: RwrPayload | RwrOpenClawPayload,
  renderHuman: () => string,
): void => {
  if (isHumanTerminal() && !getBooleanFlag(args, "json")) {
    printText(renderHuman());
    return;
  }

  printJson(payload);
};

const workItemFromPayload = (payload: RwrPayload): JsonObject =>
  asRecord(payload.result.work_item, "a work item");

const runFromPayload = (payload: RwrPayload): JsonObject => asRecord(payload.result.run, "a work run");

const workerFromPayload = (payload: RwrPayload): JsonObject =>
  asRecord(payload.result.worker, "a worker");

const relationshipFromPayload = (payload: RwrPayload): JsonObject =>
  asRecord(payload.result.relationship, "a work link");

const workRows = (workItem: JsonObject): KeyValueRow[] => [
  { label: "work id", value: idValue(workItem), valueColor: CLI_PALETTE.emphasis },
  { label: "title", value: displayValue(workItem.title) ?? "untitled" },
  { label: "status", value: displayValue(workItem.status) ?? "unknown", valueColor: CLI_PALETTE.emphasis },
  { label: "priority", value: displayValue(workItem.priority) ?? "normal" },
  ...(displayValue(workItem.desired_runner_kind)
    ? [{ label: "runs with", value: String(workItem.desired_runner_kind) }]
    : []),
  ...(displayValue(workItem.assigned_worker_id)
    ? [{ label: "assigned worker", value: String(workItem.assigned_worker_id), valueColor: CLI_PALETTE.emphasis }]
    : []),
];

const runRows = (run: JsonObject): KeyValueRow[] => [
  { label: "run id", value: idValue(run), valueColor: CLI_PALETTE.emphasis },
  { label: "work id", value: displayValue(run.work_item_id) ?? "unknown" },
  { label: "status", value: displayValue(run.status) ?? "unknown", valueColor: CLI_PALETTE.emphasis },
  { label: "worker", value: displayValue(run.worker_id) ?? "not assigned" },
  { label: "runs with", value: displayValue(run.runner_kind) ?? "unknown" },
];

const workerRows = (worker: JsonObject): KeyValueRow[] => [
  { label: "worker id", value: idValue(worker), valueColor: CLI_PALETTE.emphasis },
  { label: "name", value: displayValue(worker.name) ?? "unnamed worker" },
  { label: "role", value: displayValue(worker.worker_role) ?? "unknown" },
  { label: "status", value: displayValue(worker.status) ?? "unknown", valueColor: CLI_PALETTE.emphasis },
  { label: "worker type", value: displayValue(worker.agent_kind) ?? "unknown" },
  ...(displayValue(worker.agent_profile_id)
    ? [{ label: "agent id", value: String(worker.agent_profile_id) }]
    : []),
];

const workerTableRows = (workers: readonly JsonObject[]): TableRow[] =>
  workers.map((worker) => ({
    cells: [
      idValue(worker),
      displayValue(worker.name) ?? "unnamed worker",
      displayValue(worker.worker_role) ?? "unknown",
      displayValue(worker.agent_kind) ?? "unknown",
      displayValue(worker.status) ?? "unknown",
      displayValue(worker.last_heartbeat_at) ?? "not seen",
    ],
    colors: [
      CLI_PALETTE.emphasis,
      CLI_PALETTE.primary,
      CLI_PALETTE.primary,
      CLI_PALETTE.primary,
      CLI_PALETTE.emphasis,
      CLI_PALETTE.secondary,
    ],
  }));

export const printWorkCreateResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const workItem = workItemFromPayload(payload);
    const workId = idValue(workItem);
    const companyId = displayValue(workItem.company_id) ?? "<id>";
    const runner = displayValue(workItem.desired_runner_kind) ?? "<runner>";

    return [
      renderKeyValuePanel("◆ WORK CREATED", workRows(workItem), {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([
        `Start it with ${commandValue(`regents work run ${workId} --company-id ${companyId} --runner ${runner}`)}.`,
      ]),
    ].join("\n\n");
  });

export const printWorkListResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const companyId = displayValue(payload.result.company_id) ?? "<id>";
    const workItems = Array.isArray(payload.result.work_items)
      ? payload.result.work_items.map((item) => asRecord(item, "a work item"))
      : [];

    if (workItems.length === 0) {
      return [
        renderKeyValuePanel("◆ COMPANY WORK", [
          { label: "company", value: companyId, valueColor: CLI_PALETTE.emphasis },
          { label: "open work", value: "0" },
        ]),
        nextPanel([`Create work with ${commandValue(`regents work create --company-id ${companyId} --title "<title>"`)}.`]),
      ].join("\n\n");
    }

    return [
      renderTablePanel("◆ COMPANY WORK", [
        { header: "id", color: CLI_PALETTE.secondary },
        { header: "status", color: CLI_PALETTE.secondary },
        { header: "title", color: CLI_PALETTE.secondary },
        { header: "worker", color: CLI_PALETTE.secondary },
        { header: "updated", color: CLI_PALETTE.secondary },
      ], workItems.map((item) => ({
        cells: [
          idValue(item),
          displayValue(item.status) ?? "unknown",
          displayValue(item.title) ?? "untitled",
          displayValue(item.assigned_worker_id) ?? "not assigned",
          displayValue(item.updated_at) ?? "",
        ],
        colors: [
          CLI_PALETTE.emphasis,
          CLI_PALETTE.emphasis,
          CLI_PALETTE.primary,
          CLI_PALETTE.primary,
          CLI_PALETTE.secondary,
        ],
      }))),
      nextPanel([`Start one with ${commandValue(`regents work run <work-id> --company-id ${companyId} --runner <runner>`)}.`]),
    ].join("\n\n");
  });

export const printWorkShowResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const workItem = workItemFromPayload(payload);
    const workId = idValue(workItem);
    const companyId = displayValue(workItem.company_id) ?? "<id>";

    return [
      renderKeyValuePanel("◆ WORK ITEM", workRows(workItem), {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([`Start it with ${commandValue(`regents work run ${workId} --company-id ${companyId} --runner <runner>`)}.`]),
    ].join("\n\n");
  });

export const printWorkRunResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const run = runFromPayload(payload);
    const runId = idValue(run);
    const companyId = displayValue(run.company_id) ?? "<id>";

    return [
      renderKeyValuePanel("◆ WORK STARTED", runRows(run), {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([`Check progress with ${commandValue(`regents work watch ${runId} --company-id ${companyId}`)}.`]),
    ].join("\n\n");
  });

export const printWorkWatchResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const runId = displayValue(payload.result.run_id) ?? "<run-id>";
    const companyId = getFlag(args, "company-id") ?? "<id>";
    const events = Array.isArray(payload.result.events)
      ? payload.result.events.map((event) => asRecord(event, "a run update"))
      : [];

    if (events.length === 0) {
      return [
        renderKeyValuePanel("◆ RUN UPDATES", [
          { label: "run id", value: runId, valueColor: CLI_PALETTE.emphasis },
          { label: "updates", value: "0" },
        ]),
        nextPanel([`Check again with ${commandValue(`regents work watch ${runId} --company-id ${companyId}`)}.`]),
      ].join("\n\n");
    }

    return [
      renderKeyValuePanel("◆ RUN UPDATES", [
        { label: "run id", value: runId, valueColor: CLI_PALETTE.emphasis },
        { label: "updates", value: String(events.length), valueColor: CLI_PALETTE.emphasis },
        { label: "latest", value: displayValue(events.at(-1)?.occurred_at) ?? "unknown" },
      ]),
      renderTablePanel("◆ UPDATE LIST", [
        { header: "#", align: "right", color: CLI_PALETTE.secondary },
        { header: "update", color: CLI_PALETTE.secondary },
        { header: "actor", color: CLI_PALETTE.secondary },
        { header: "time", color: CLI_PALETTE.secondary },
      ], events.map((event) => ({
        cells: [
          displayValue(event.sequence) ?? idValue(event),
          displayValue(event.kind) ?? "update",
          [optionalString(event.actor_kind), optionalString(event.actor_id)].filter(Boolean).join(":") || "Regent",
          displayValue(event.occurred_at) ?? "",
        ],
        colors: [
          CLI_PALETTE.emphasis,
          CLI_PALETTE.primary,
          CLI_PALETTE.primary,
          CLI_PALETTE.secondary,
        ],
      }))),
    ].join("\n\n");
  });

export const printAgentConnectHermesResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const worker = workerFromPayload(payload);
    const workerId = idValue(worker);
    const companyId = displayValue(worker.company_id) ?? "<id>";

    return [
      renderKeyValuePanel("◆ HERMES CONNECTED", workerRows(worker), {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([
        `Choose who can receive work with ${commandValue(`regents agent link --company-id ${companyId} --manager-worker-id ${workerId} --executor-worker-id <worker-id> --relationship can_delegate_to`)}.`,
      ]),
    ].join("\n\n");
  });

export const printAgentConnectOpenClawResult = (args: ParsedCliArgs, payload: RwrOpenClawPayload): void =>
  printRwrPayload(args, payload, () => {
    const worker = workerFromPayload(payload);
    const workerId = idValue(worker);
    const companyId = displayValue(worker.company_id) ?? "<id>";

    return [
      renderKeyValuePanel("◆ OPENCLAW CONNECTED", [
        ...workerRows(worker),
        ...(payload.openclaw.skillFile
          ? [{ label: "skill file", value: payload.openclaw.skillFile, valueColor: CLI_PALETTE.emphasis }]
          : []),
      ], {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([
        payload.openclaw.skillFile
          ? `OpenClaw can now use ${tone("regents-work", CLI_PALETTE.emphasis, true)} from ${payload.openclaw.skillFile}.`
          : "OpenClaw was connected. No local skill file was written.",
        `Start work with ${commandValue(`regents work run <work-id> --company-id ${companyId} --runner openclaw_local_executor --worker-id ${workerId}`)}.`,
      ]),
    ].join("\n\n");
  });

export const printAgentLinkResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const relationship = relationshipFromPayload(payload);
    const companyId = displayValue(relationship.company_id) ?? "<id>";
    const manager =
      displayValue(relationship.source_agent_profile_id) ?? displayValue(relationship.source_worker_id) ?? "<manager>";
    const executor =
      displayValue(relationship.target_agent_profile_id) ?? displayValue(relationship.target_worker_id) ?? "<worker>";

    return [
      renderKeyValuePanel("◆ WORK LINK READY", [
        { label: "link id", value: idValue(relationship), valueColor: CLI_PALETTE.emphasis },
        { label: "manager", value: manager },
        { label: "worker", value: executor },
        { label: "link type", value: displayValue(relationship.relationship_kind) ?? "unknown" },
        { label: "status", value: displayValue(relationship.status) ?? "unknown", valueColor: CLI_PALETTE.emphasis },
      ], {
        borderColor: CLI_PALETTE.chrome,
        titleColor: CLI_PALETTE.title,
      }),
      nextPanel([`List assignable workers with ${commandValue(`regents agent execution-pool --company-id ${companyId} --manager ${manager}`)}.`]),
    ].join("\n\n");
  });

export const printAgentExecutionPoolResult = (args: ParsedCliArgs, payload: RwrPayload): void =>
  printRwrPayload(args, payload, () => {
    const companyId = displayValue(payload.result.company_id) ?? "<id>";
    const workers = Array.isArray(payload.result.workers)
      ? payload.result.workers.map((worker) => asRecord(worker, "a worker"))
      : [];

    if (workers.length === 0) {
      return [
        renderKeyValuePanel("◆ ASSIGNABLE WORKERS", [
          { label: "company", value: companyId, valueColor: CLI_PALETTE.emphasis },
          { label: "workers", value: "0" },
        ]),
        nextPanel([`Connect a worker with ${commandValue(`regents agent connect openclaw --company-id ${companyId} --role executor`)}.`]),
      ].join("\n\n");
    }

    return [
      renderKeyValuePanel("◆ ASSIGNABLE WORKERS", [
        { label: "company", value: companyId, valueColor: CLI_PALETTE.emphasis },
        { label: "workers", value: String(workers.length), valueColor: CLI_PALETTE.emphasis },
      ]),
      renderTablePanel("◆ WORKER LIST", [
        { header: "id", color: CLI_PALETTE.secondary },
        { header: "name", color: CLI_PALETTE.secondary },
        { header: "role", color: CLI_PALETTE.secondary },
        { header: "worker type", color: CLI_PALETTE.secondary },
        { header: "status", color: CLI_PALETTE.secondary },
        { header: "last seen", color: CLI_PALETTE.secondary },
      ], workerTableRows(workers)),
      nextPanel([`Start work with ${commandValue(`regents work run <work-id> --company-id ${companyId} --runner <runner> --worker-id <worker-id>`)}.`]),
    ].join("\n\n");
  });
