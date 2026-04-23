import type {
  RegentConfig,
  XmtpGroupAddMembersResult,
  XmtpGroupCreateResult,
  XmtpGroupListResult,
  XmtpGroupMembersResult,
  XmtpGroupPermissionUpdateResult,
  XmtpGroupPermissionsResult,
  XmtpGroupRemoveMembersResult,
} from "../../internal-types/index.js";

import { RegentError } from "../errors.js";
import { runConnectedXmtpCliJson } from "./cli-adapter.js";
import { normalizeXmtpRecentConversation } from "./conversations.js";
import { recordXmtpRecentConversation, updateXmtpRuntimeState } from "./state.js";

interface XmtpCliConversationRecord {
  id?: string;
  type?: string;
  createdAt?: string;
  peerInboxId?: string;
  name?: string;
}

interface XmtpCliCreateGroupResult {
  id?: string;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  memberCount?: number;
  members?: Array<{
    inboxId?: string;
    permissionLevel?: string | number;
  }>;
}

interface XmtpCliAddMembersResult {
  conversationId?: string;
  addedMembers?: string[];
  count?: number;
}

interface XmtpCliRemoveMembersResult {
  success?: boolean;
  conversationId?: string;
  removedMembers?: string[];
  count?: number;
}

interface XmtpCliGroupMemberRecord {
  inboxId?: string;
  accountIdentifiers?: string[];
  installationIds?: string[];
  permissionLevel?: string | number | null;
  consentState?: string | null;
}

interface XmtpCliGroupPermissionsResult {
  conversationId?: string;
  permissions?: {
    policyType?: string | null;
    policySet?: Record<string, unknown>;
  };
}

interface XmtpCliGroupPermissionUpdateResult {
  success?: boolean;
  conversationId?: string;
  permissionType?: string;
  policy?: string;
  metadataField?: string | null;
}

export const listXmtpGroups = async (
  config: RegentConfig["xmtp"],
  options?: { sync?: boolean },
): Promise<XmtpGroupListResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliConversationRecord[]>(
    config,
    [
      "conversations",
      "list",
      "--type",
      "group",
      ...(options?.sync ? ["--sync"] : []),
    ],
  );

  const conversations = payload.map(normalizeXmtpRecentConversation);
  if (conversations[0]) {
    recordXmtpRecentConversation(config, conversations[0]);
  }

  return {
    ok: true,
    conversations,
  };
};

export const createXmtpGroup = async (
  config: RegentConfig["xmtp"],
  members: string[],
  options?: {
    name?: string;
    description?: string;
    imageUrl?: string;
    permissions?: "all-members" | "admin-only";
  },
): Promise<XmtpGroupCreateResult> => {
  if (members.length === 0) {
    throw new RegentError("xmtp_group_members_missing", "at least one member address is required");
  }

  const payload = await runConnectedXmtpCliJson<XmtpCliCreateGroupResult>(config, [
    "conversations",
    "create-group",
    ...members.map((member) => member.toLowerCase()),
    ...(options?.name ? ["--name", options.name] : []),
    ...(options?.description ? ["--description", options.description] : []),
    ...(options?.imageUrl ? ["--image-url", options.imageUrl] : []),
    ...(options?.permissions ? ["--permissions", options.permissions] : []),
  ]);

  if (!payload.id) {
    throw new RegentError("xmtp_cli_error", "group create did not return a conversation id");
  }

  recordXmtpRecentConversation(config, {
    id: payload.id,
    type: "group",
    name: payload.name ?? undefined,
  });
  updateXmtpRuntimeState(config, (current) => ({
    ...current,
    metrics: {
      ...current.metrics,
      groupsCreated: current.metrics.groupsCreated + 1,
    },
  }));

  return {
    ok: true,
    id: payload.id,
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl,
    memberCount: payload.memberCount ?? payload.members?.length ?? 0,
    members: (payload.members ?? []).map((member) => ({
      inboxId: member.inboxId ?? "unknown",
      permissionLevel: member.permissionLevel,
    })),
  };
};

export const addXmtpGroupMembers = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  members: string[],
): Promise<XmtpGroupAddMembersResult> => {
  if (members.length === 0) {
    throw new RegentError("xmtp_group_members_missing", "at least one member address is required");
  }

  const payload = await runConnectedXmtpCliJson<XmtpCliAddMembersResult>(config, [
    "conversation",
    "add-members",
    conversationId,
    ...members.map((member) => member.toLowerCase()),
  ]);

  updateXmtpRuntimeState(config, (current) => ({
    ...current,
    metrics: {
      ...current.metrics,
      membersAdded: current.metrics.membersAdded + (payload.count ?? members.length),
    },
  }));

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    addedMembers: payload.addedMembers ?? members,
    count: payload.count ?? members.length,
  };
};

export const removeXmtpGroupMembers = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  members: string[],
): Promise<XmtpGroupRemoveMembersResult> => {
  if (members.length === 0) {
    throw new RegentError("xmtp_group_members_missing", "at least one member address is required");
  }

  const payload = await runConnectedXmtpCliJson<XmtpCliRemoveMembersResult>(config, [
    "conversation",
    "remove-members",
    conversationId,
    ...members.map((member) => member.toLowerCase()),
  ]);

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    removedMembers: payload.removedMembers ?? members,
    count: payload.count ?? members.length,
  };
};

export const listXmtpGroupMembers = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  options?: { sync?: boolean },
): Promise<XmtpGroupMembersResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliGroupMemberRecord[]>(config, [
    "conversation",
    "members",
    conversationId,
    ...(options?.sync ? ["--sync"] : []),
  ]);

  const members = payload.map((member) => ({
    inboxId: member.inboxId ?? "unknown",
    accountIdentifiers: member.accountIdentifiers ?? [],
    installationIds: member.installationIds ?? [],
    permissionLevel: member.permissionLevel ?? null,
    consentState: member.consentState ?? null,
  }));

  return {
    ok: true,
    conversationId,
    members,
    count: members.length,
  };
};

export const getXmtpGroupPermissions = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
): Promise<XmtpGroupPermissionsResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliGroupPermissionsResult>(config, [
    "conversation",
    "permissions",
    conversationId,
  ]);

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    permissions: {
      policyType: payload.permissions?.policyType ?? null,
      policySet: payload.permissions?.policySet ?? {},
    },
  };
};

export const updateXmtpGroupPermission = async (
  config: RegentConfig["xmtp"],
  conversationId: string,
  input: {
    type: string;
    policy: string;
    metadataField?: string;
  },
): Promise<XmtpGroupPermissionUpdateResult> => {
  const payload = await runConnectedXmtpCliJson<XmtpCliGroupPermissionUpdateResult>(config, [
    "conversation",
    "update-permission",
    conversationId,
    "--type",
    input.type,
    "--policy",
    input.policy,
    ...(input.metadataField ? ["--metadata-field", input.metadataField] : []),
  ]);

  return {
    ok: true,
    conversationId: payload.conversationId ?? conversationId,
    permissionType: payload.permissionType ?? input.type,
    policy: payload.policy ?? input.policy,
    metadataField: payload.metadataField ?? input.metadataField ?? null,
  };
};
