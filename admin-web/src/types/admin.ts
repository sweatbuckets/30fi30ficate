export interface DomainFormState {
  domain: string;
  ownerAddress: string;
}

export interface ApprovalFormState {
  domain: string;
  certHash: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  memo: string;
}

export interface RevocationFormState {
  domain: string;
  certHash: string;
  memo: string;
}

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

export interface DashboardCertificateItem {
  certHash: `0x${string}`;
  status: CertificateStatusView;
}

export interface PendingCertificateItem {
  id: string;
  domain: string;
  certHash: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  memo: string;
  source: "crt.sh" | "sslmate";
  identities: string[];
  crtShId: number;
  reviewState: PendingCertificateReviewState;
  wildcard: boolean;
  exactMatch: boolean;
}

export type PendingCertificateReviewState =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Revoked"
  | "Needs Review";

export interface CrtSearchResultItem {
  id: string;
  domain: string;
  certHash: string;
  issuer: string;
  subject: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  revoked?: boolean | null;
  source: "crt.sh" | "sslmate";
  identities: string[];
  externalId: string;
  externalLabel: string;
  wildcard: boolean;
  exactMatch: boolean;
  reviewState: CrtSearchReviewState;
}

export type CrtSearchReviewState = "Pending" | "Rejected" | "Needs Review";

export interface CrtShRawEntry {
  id: number;
  issuer_name?: string;
  common_name?: string;
  name_value?: string;
  serial_number?: string;
  not_before?: string;
  not_after?: string;
}

export interface SSLMateIssuer {
  friendly_name?: string;
  name?: string;
}

export interface SSLMateIssuanceEntry {
  id: string;
  cert_sha256?: string;
  cert_der?: string;
  dns_names?: string[];
  issuer?: SSLMateIssuer;
  not_before?: string;
  not_after?: string;
  revoked?: boolean | null;
}
