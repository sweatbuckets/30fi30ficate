import type {
  CrtShRawEntry,
  CrtSearchResultItem,
  CrtSearchReviewState,
  SSLMateIssuanceEntry
} from "../../types/admin";

function splitIdentities(value?: string): string[] {
  return (value ?? "")
    .split(/\n+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function chooseSubject(entry: CrtShRawEntry, identities: string[]): string {
  return entry.common_name?.trim() || identities[0] || "Unknown subject";
}

function determineReviewState(
  targetDomain: string | string[],
  identities: string[]
): { wildcard: boolean; exactMatch: boolean; reviewState: CrtSearchReviewState } {
  const wildcard = identities.some((identity) => identity.startsWith("*."));
  const targetDomains = Array.isArray(targetDomain) ? targetDomain : [targetDomain];
  const exactMatch = targetDomains.some((domain) => identities.includes(domain));

  if (wildcard || !exactMatch) {
    return {
      wildcard,
      exactMatch,
      reviewState: "Needs Review"
    };
  }

  return {
    wildcard,
    exactMatch,
    reviewState: "Pending"
  };
}

export function normalizeCrtShEntries(
  domain: string,
  entries: CrtShRawEntry[]
): CrtSearchResultItem[] {
  const normalizedDomain = domain.trim().toLowerCase();
  return entries.map((entry, index) => {
    const identities = splitIdentities(entry.name_value);
    const review = determineReviewState(normalizedDomain, identities);

    return {
      id: `${normalizedDomain}:${entry.id}:${index}`,
      domain: normalizedDomain,
      certHash: "",
      issuer: entry.issuer_name?.trim() || "Unknown issuer",
      subject: chooseSubject(entry, identities),
      serialNumber: entry.serial_number?.trim() || "Unknown serial",
      validFrom: entry.not_before ?? "",
      validTo: entry.not_after ?? "",
      revoked: undefined,
      source: "crt.sh" as const,
      identities,
      externalId: String(entry.id),
      externalLabel: `crt.sh ID ${entry.id}`,
      wildcard: review.wildcard,
      exactMatch: review.exactMatch,
      reviewState: review.reviewState
    };
  });
}

export function normalizeSslmateEntries(
  domain: string,
  entries: SSLMateIssuanceEntry[]
): CrtSearchResultItem[] {
  const normalizedDomain = domain.trim().toLowerCase();

  return entries.map((entry, index) => {
    const identities = (entry.dns_names ?? [])
      .map((dnsName) => dnsName.trim().toLowerCase())
      .filter(Boolean);
    const review = determineReviewState(normalizedDomain, identities);

    return {
      id: `${normalizedDomain}:${entry.id}:${index}`,
      domain: normalizedDomain,
      certHash: entry.cert_sha256 ? `0x${entry.cert_sha256}` : "",
      issuer:
        entry.issuer?.friendly_name?.trim() ||
        entry.issuer?.name?.trim() ||
        "Unknown issuer",
      subject: identities[0] || "Unknown subject",
      serialNumber: "",
      validFrom: entry.not_before ?? "",
      validTo: entry.not_after ?? "",
      revoked: entry.revoked ?? null,
      source: "sslmate",
      identities,
      externalId: entry.id,
      externalLabel: `SSLMate issuance ${entry.id}`,
      wildcard: review.wildcard,
      exactMatch: review.exactMatch,
      reviewState: review.reviewState
    };
  });
}

export function normalizeGroupedSslmateEntries(
  domains: string[],
  entries: SSLMateIssuanceEntry[]
): CrtSearchResultItem[] {
  const normalizedDomains = domains
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const primaryDomain = normalizedDomains[0] ?? "";

  return entries.map((entry, index) => {
    const identities = (entry.dns_names ?? [])
      .map((dnsName) => dnsName.trim().toLowerCase())
      .filter(Boolean);
    const review = determineReviewState(normalizedDomains, identities);

    return {
      id: `${primaryDomain}:${entry.id}:${index}`,
      domain: primaryDomain,
      certHash: entry.cert_sha256 ? `0x${entry.cert_sha256}` : "",
      issuer:
        entry.issuer?.friendly_name?.trim() ||
        entry.issuer?.name?.trim() ||
        "Unknown issuer",
      subject: identities[0] || "Unknown subject",
      serialNumber: "",
      validFrom: entry.not_before ?? "",
      validTo: entry.not_after ?? "",
      revoked: entry.revoked ?? null,
      source: "sslmate",
      identities,
      externalId: entry.id,
      externalLabel: `SSLMate issuance ${entry.id}`,
      wildcard: review.wildcard,
      exactMatch: review.exactMatch,
      reviewState: review.reviewState
    };
  });
}
