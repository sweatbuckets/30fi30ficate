import { keccak256, stringToHex } from "viem";

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

export function buildDomainCandidates(input: string): string[] {
  const normalizedDomain = normalizeDomain(input);
  if (!normalizedDomain) {
    return [];
  }

  const candidates = new Set<string>([normalizedDomain]);
  if (normalizedDomain.startsWith("www.") && normalizedDomain.length > 4) {
    candidates.add(normalizedDomain.slice(4));
  } else {
    candidates.add(`www.${normalizedDomain}`);
  }

  return Array.from(candidates);
}

export function deriveDomainHash(chainId: number, domain: string): `0x${string}` {
  return keccak256(stringToHex(`${chainId}:${normalizeDomain(domain)}`));
}
