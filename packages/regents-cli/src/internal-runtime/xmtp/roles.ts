import type {
  RegentConfig,
  XmtpGroupRoleListResult,
  XmtpGroupRoleMutationResult,
} from "../../internal-types/index.js";

import { runConnectedXmtpCliJson } from "./cli-adapter.js";

interface XmtpCliGroupRoleListResult {
  conversationId?: string;
  admins?: string[];
  superAdmins?: string[];
  count?: number;
}

interface XmtpCliGroupRoleMutationResult {
  success?: boolean;
  conversationId?: string;
  inboxId?: string;
  message?: string;
}

const listXmtpGroupRole = async (
  config: RegentConfig["xmtp"],
  command: "list-admins" | "list-super-admins",
  conversationId: string,
): Promise<XmtpGroupRoleListResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliGroupRoleListResult>(config, [
    "conversation",
    command,
    conversationId,
  ]);

  const items = command === "list-admins" ? (payload.admins ?? []) : (payload.superAdmins ?? []);

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    items,
    count: payload.count ?? items.length,
  };
};

export const listXmtpGroupAdmins = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
): Promise<XmtpGroupRoleListResult> => listXmtpGroupRole(config, "list-admins", conversationId);

export const listXmtpGroupSuperAdmins = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
): Promise<XmtpGroupRoleListResult> => listXmtpGroupRole(config, "list-super-admins", conversationId);

const mutateXmtpGroupRole = async (
  config: RegentConfig["xmtp"],
  command: "add-admin" | "remove-admin" | "add-super-admin" | "remove-super-admin",
  conversationId: string,
  inboxId: string,
): Promise<XmtpGroupRoleMutationResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliGroupRoleMutationResult>(config, [
    "conversation",
    command,
    conversationId,
    inboxId,
  ]);

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    inboxId: payload.inboxId ?? inboxId,
    message: payload.message ?? "Group role updated",
  };
};

export const addXmtpGroupAdmin = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  inboxId: string,
): Promise<XmtpGroupRoleMutationResult> => mutateXmtpGroupRole(config, "add-admin", conversationId, inboxId);

export const removeXmtpGroupAdmin = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  inboxId: string,
): Promise<XmtpGroupRoleMutationResult> => mutateXmtpGroupRole(config, "remove-admin", conversationId, inboxId);

export const addXmtpGroupSuperAdmin = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  inboxId: string,
): Promise<XmtpGroupRoleMutationResult> => mutateXmtpGroupRole(config, "add-super-admin", conversationId, inboxId);

export const removeXmtpGroupSuperAdmin = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  inboxId: string,
): Promise<XmtpGroupRoleMutationResult> => mutateXmtpGroupRole(config, "remove-super-admin", conversationId, inboxId);
