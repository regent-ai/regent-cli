import fs from "node:fs";

import type { RegentConfig, XmtpStatus } from "../../internal-types/index.js";

import { errorMessage } from "../errors.js";
import { loadXmtpClientInfo, xmtpMaterialExists } from "./material.js";
import {
  getXmtpRoutingStatus,
  XMTP_TRACKED_NOT_ROUTED_NOTE,
} from "./routing-status.js";
import { readXmtpRuntimeState, type XmtpRuntimeState } from "./state.js";

const buildBaseStatus = (
  config: RegentConfig["xmtp"],
  runtimeState: XmtpRuntimeState,
  options?: { started?: boolean; lastError?: string | null },
): Omit<XmtpStatus, "status" | "note" | "client" | "connected" | "ready"> => ({
  enabled: config.enabled,
  configured: xmtpMaterialExists(config) && fs.existsSync(config.publicPolicyPath),
  started: options?.started ?? false,
  env: config.env,
  dbPath: config.dbPath,
  walletKeyPath: config.walletKeyPath,
  dbEncryptionKeyPath: config.dbEncryptionKeyPath,
  publicPolicyPath: config.publicPolicyPath,
  ownerInboxIds: [...config.ownerInboxIds],
  trustedInboxIds: [...config.trustedInboxIds],
  profiles: { ...config.profiles },
  lastError: options?.lastError ?? runtimeState.recentErrors[0]?.message ?? null,
  recentErrors: [...runtimeState.recentErrors],
  recentConversations: [...runtimeState.recentConversations],
  metrics: { ...runtimeState.metrics },
  routeState: getXmtpRoutingStatus(config.enabled).routeState,
});

export const getXmtpStatus = async (
  config: RegentConfig["xmtp"],
  options?: { started?: boolean; lastError?: string | null },
): Promise<XmtpStatus> => {
  const runtimeState = readXmtpRuntimeState(config);
  const base = buildBaseStatus(config, runtimeState, options);

  if (!config.enabled) {
    return {
      ...base,
      enabled: false,
      configured: base.configured,
      connected: false,
      ready: false,
      status: "disabled",
      note: "XMTP is disabled in config",
      routeState: getXmtpRoutingStatus(false).routeState,
      client: null,
    };
  }

  if (!base.configured) {
    return {
      ...base,
      connected: false,
      ready: false,
      status: "degraded",
      note: "XMTP material is incomplete; run `regents xmtp init`",
      client: null,
    };
  }

  try {
    const client = await loadXmtpClientInfo(config);
    const connected = (options?.started ?? false) && runtimeState.connected;

    return {
      ...base,
      connected,
      ready: true,
      status: connected ? "ready" : (options?.started ?? false) ? "starting" : "stopped",
      note: connected ? XMTP_TRACKED_NOT_ROUTED_NOTE : "XMTP identity is initialized and ready",
      client,
    };
  } catch (error) {
    return {
      ...base,
      connected: false,
      ready: false,
      status: (options?.started ?? false) ? "error" : "degraded",
      note: "XMTP CLI probe failed",
      lastError: errorMessage(error),
      client: null,
    };
  }
};
