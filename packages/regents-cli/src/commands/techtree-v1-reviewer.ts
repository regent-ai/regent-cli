import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { BbhReviewerOrcidLinkResponse } from "../internal-types/index.js";

import { daemonCall } from "../daemon-client.js";
import { getFlag, type ParsedCliArgs } from "../parse.js";
import { printJson } from "../printer.js";
import { parseCsvFlag } from "./techtree-v1-shared.js";

const execFileAsync = promisify(execFile);

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const requireOrcidPayload = (response: BbhReviewerOrcidLinkResponse): NonNullable<BbhReviewerOrcidLinkResponse["data"]> => {
  if (!response || typeof response !== "object" || !("data" in response) || !response.data || typeof response.data !== "object") {
    throw new Error("invalid ORCID link response envelope");
  }

  if (typeof response.data.request_id !== "string" || typeof response.data.state !== "string") {
    throw new Error("invalid ORCID link response payload");
  }

  return response.data;
};

const parsePositiveIntegerFlag = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`invalid ${name}`);
  }

  return parsed;
};

const openBrowser = async (url: string): Promise<boolean> => {
  try {
    if (process.platform === "darwin") {
      await execFileAsync("open", [url]);
      return true;
    }

    if (process.platform === "win32") {
      await execFileAsync("cmd", ["/c", "start", "", url]);
      return true;
    }

    await execFileAsync("xdg-open", [url]);
    return true;
  } catch {
    return false;
  }
};

export async function runTechtreeReviewerOrcidLink(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const pollIntervalMs = parsePositiveIntegerFlag(getFlag(args, "poll-interval-ms"), 2000, "poll interval");
  const timeoutMs = parsePositiveIntegerFlag(getFlag(args, "timeout-ms"), 120000, "timeout");

  const started = await daemonCall("techtree.v1.reviewer.orcid.link", undefined, configPath) as BbhReviewerOrcidLinkResponse;
  const startedData = requireOrcidPayload(started);
  let browserOpenFailed = false;
  if (startedData.start_url) {
    const opened = await openBrowser(startedData.start_url);
    if (!opened) {
      browserOpenFailed = true;
    }
  }

  const deadline = Date.now() + timeoutMs;
  let latest = started;

  while (requireOrcidPayload(latest).state === "pending" && Date.now() < deadline) {
    await sleep(pollIntervalMs);
    latest = await daemonCall(
      "techtree.v1.reviewer.orcid.link",
      { request_id: requireOrcidPayload(latest).request_id },
      configPath,
    ) as BbhReviewerOrcidLinkResponse;
  }

  const latestData = requireOrcidPayload(latest);

  if (latestData.state === "pending") {
    printJson({
      data: {
        ...latestData,
        state: "timed_out",
        ...(browserOpenFailed && startedData.start_url
          ? { start_url: startedData.start_url, fallback: "browser_open_failed" }
          : {}),
      },
    });
    return;
  }

  printJson({
    data: {
      ...latestData,
      ...(browserOpenFailed && startedData.start_url
        ? { start_url: startedData.start_url, fallback: "browser_open_failed" }
        : {}),
    },
  });
}

export async function runTechtreeReviewerApply(args: ParsedCliArgs, configPath?: string): Promise<void> {
  const payoutWallet = getFlag(args, "payout-wallet");
  printJson(
    await daemonCall(
      "techtree.v1.reviewer.apply",
      {
        domain_tags: parseCsvFlag(args, "tag"),
        ...(payoutWallet ? { payout_wallet: payoutWallet as `0x${string}` } : {}),
        ...(getFlag(args, "summary") ? { experience_summary: getFlag(args, "summary") } : {}),
      },
      configPath,
    ),
  );
}

export async function runTechtreeReviewerStatus(configPath?: string): Promise<void> {
  printJson(await daemonCall("techtree.v1.reviewer.status", undefined, configPath));
}
