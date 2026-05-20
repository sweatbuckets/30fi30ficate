import { keccak256, stringToHex } from "viem";

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

export function deriveDomainHash(chainId: number, domain: string): `0x${string}` {
  return keccak256(stringToHex(`${chainId}:${normalizeDomain(domain)}`));
}

