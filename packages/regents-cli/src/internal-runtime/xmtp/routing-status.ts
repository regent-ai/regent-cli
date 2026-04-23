import type { XmtpStatus } from "../../internal-types/index.js";

export type XmtpRouteState = XmtpStatus["routeState"];

export interface XmtpRoutingStatus {
  routeState: XmtpRouteState;
  trackedButNotRouted: boolean;
}

export const XMTP_TRACKED_NOT_ROUTED_NOTE =
  "XMTP daemon monitor is live; inbound messages are tracked, but Regent does not yet route them into managed agent sessions";

export const getXmtpRoutingStatus = (enabled: boolean): XmtpRoutingStatus => {
  if (!enabled) {
    return {
      routeState: "disabled",
      trackedButNotRouted: false,
    };
  }

  return {
    routeState: "blocked",
    trackedButNotRouted: true,
  };
};
