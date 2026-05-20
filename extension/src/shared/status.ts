export const verificationStatuses = [
  "Approved",
  "Unapproved",
  "Revoked",
  "HTTP",
  "TLSObservationFailure",
  "RPCFailure",
  "Unknown"
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];
