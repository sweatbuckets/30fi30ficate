import type { VerificationResult } from "../shared/types";
import { deriveOrigin, normalizeDomain } from "./domain";

const latestStateByTabId = new Map<number, VerificationResult>();
const latestStateByOrigin = new Map<string, VerificationResult>();

function isReusableOriginState(result: VerificationResult): boolean {
  return (
    result.evidence.tlsObserved &&
    (result.status === "Approved" ||
      result.status === "Unapproved" ||
      result.status === "Revoked")
  );
}

export function setLatestVerificationState(result: VerificationResult): void {
  latestStateByTabId.set(result.tabId, result);
  if (isReusableOriginState(result)) {
    latestStateByOrigin.set(deriveOrigin(result.url), result);
  }
}

export function clearLatestVerificationState(tabId: number): void {
  latestStateByTabId.delete(tabId);
}

export function getLatestVerificationState(
  tabId: number,
  url?: string
): VerificationResult | null {
  return latestStateByTabId.get(tabId) ?? getLatestVerificationStateByUrl(url);
}

export function getLatestVerificationStateByUrl(
  url?: string
): VerificationResult | null {
  if (!url) {
    return null;
  }

  return latestStateByOrigin.get(deriveOrigin(url)) ?? null;
}

export function applyCachedVerificationStateToTab(
  tabId: number,
  url: string
): VerificationResult | null {
  const cachedResult = getLatestVerificationStateByUrl(url);
  if (!cachedResult) {
    return null;
  }

  const parsedUrl = new URL(url);
  const nextResult: VerificationResult = {
    ...cachedResult,
    tabId,
    url,
    hostname: parsedUrl.hostname,
    normalizedDomain: normalizeDomain(parsedUrl.hostname)
  };

  latestStateByTabId.set(tabId, nextResult);
  return nextResult;
}
