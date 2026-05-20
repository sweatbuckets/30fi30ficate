export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

export const REGISTRY_CONTRACT_ADDRESS =
  "0x389a1E72a2da31eb452377D8AF84f87344EF4b6b" as const;

export const ETHEREUM_SEPOLIA_RPC_URL =
  "https://ethereum-sepolia-rpc.publicnode.com";

export const POPUP_STATE_REQUEST = "popup:get-latest-state";
export const POPUP_RECHECK_REQUEST = "popup:recheck-active-tab";
export const STATE_UPDATED_EVENT = "state:updated";

export const BADGE_LABELS = {
  approved: "OK",
  unapproved: "WARN",
  revoked: "REV",
  http: "HTTP",
  tlsObservationFailure: "TLS",
  rpcFailure: "RPC",
  unknown: "..."
} as const;

export const BADGE_COLORS = {
  approved: "#1f8f4f",
  unapproved: "#c0392b",
  revoked: "#8e1b10",
  http: "#7f8c8d",
  tlsObservationFailure: "#b7791f",
  rpcFailure: "#d4a017",
  unknown: "#4b5563"
} as const;
