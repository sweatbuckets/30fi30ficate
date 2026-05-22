import type { VerificationStatus } from "./status";

export interface CertificateStatusView {
  exists: boolean;
  approved: boolean;
  revoked: boolean;
  approvedAt: bigint;
  revokedAt: bigint;
  issuer: string;
  subject: string;
  serialNumber: string;
  validFrom: bigint;
  validTo: bigint;
  fingerprintAlgorithm: string;
  memo: string;
}

export interface CertificateObservation {
  certHash: `0x${string}`;
  issuer: string;
  subject: string;
  serialNumber: string;
  validFrom?: number;
  validTo?: number;
  fingerprintAlgorithm: string;
  chain: CertificateChainEntry[];
}

export interface CertificateChainEntry {
  role: "leaf" | "intermediate" | "root";
  subject: string;
  issuer: string;
}

export interface BrowserRequestContext {
  requestId: string;
  tabId: number;
  url: string;
  hostname: string;
  normalizedDomain: string;
  scheme: "http" | "https";
  requestType?: string;
}

export interface PopupStateRequest {
  type: typeof import("./constants").POPUP_STATE_REQUEST;
  tabId?: number;
  url?: string;
}

export interface PopupRecheckRequest {
  type: typeof import("./constants").POPUP_RECHECK_REQUEST;
  tabId?: number;
}

export interface PopupStateUpdate {
  type: typeof import("./constants").STATE_UPDATED_EVENT;
  payload: VerificationResult;
}

export interface VerificationResult {
  tabId: number;
  url: string;
  hostname: string;
  normalizedDomain: string;
  matchedDomain?: string;
  domainHash?: `0x${string}`;
  certHash?: `0x${string}`;
  status: VerificationStatus;
  message: string;
  checkedAt: number;
  issuer?: string;
  subject?: string;
  serialNumber?: string;
  certificateChain?: CertificateChainEntry[];
  source: "runtime_tls";
  evidence: {
    onChainStatus?: CertificateStatusView;
    rpcConfigured: boolean;
    tlsObserved: boolean;
    futureCtContext?: {
      pendingCandidate: boolean;
      source?: "ct";
    };
  };
}

export interface RawFirefoxCertificate {
  rawDER?: ArrayBuffer | number[];
  issuer?: string;
  subject?: string;
  serialNumber?: string;
  validity?: {
    start?: string | number;
    end?: string | number;
  };
  fingerprints?: {
    sha256?: string;
  };
  fingerprint?: {
    sha256?: string;
  };
}

export interface RawFirefoxSecurityInfo {
  state?: string;
  certificates?: RawFirefoxCertificate[];
}
