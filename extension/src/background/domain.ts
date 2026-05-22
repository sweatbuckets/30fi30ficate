import { keccak256, stringToHex } from "viem";

export function normalizeDomain(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

export function buildDomainCandidates(normalizedDomain: string): string[] {
  const exact = normalizeDomain(normalizedDomain);
  const candidates = new Set<string>([exact]);

  if (exact.startsWith("www.") && exact.length > 4) {
    candidates.add(exact.slice(4));
  } else {
    candidates.add(`www.${exact}`);
  }

  return Array.from(candidates);
}

export function areEquivalentDomains(left: string, right: string): boolean {
  const leftNormalized = normalizeDomain(left);
  const rightNormalized = normalizeDomain(right);

  if (leftNormalized === rightNormalized) {
    return true;
  }

  const leftCandidates = buildDomainCandidates(leftNormalized);
  return leftCandidates.includes(rightNormalized);
}

export function deriveOrigin(url: string): string {
  const parsedUrl = new URL(url);
  return parsedUrl.origin;
}

export function deriveDomainHash(
  chainId: number,
  normalizedDomain: string
): `0x${string}` {
  return keccak256(stringToHex(`${chainId}:${normalizedDomain}`));
}
