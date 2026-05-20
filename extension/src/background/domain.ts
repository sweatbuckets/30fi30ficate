import { keccak256, stringToHex } from "viem";

export function normalizeDomain(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
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
