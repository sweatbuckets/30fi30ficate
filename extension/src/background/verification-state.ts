import type {
  BrowserRequestContext,
  CertificateObservation,
  CertificateStatusView,
  VerificationResult
} from "../shared/types";

export function buildHttpResult(context: BrowserRequestContext): VerificationResult {
  return {
    tabId: context.tabId,
    url: context.url,
    hostname: context.hostname,
    normalizedDomain: context.normalizedDomain,
    status: "HTTP",
    message: "HTTPS 인증서 검증 대상이 아닙니다.",
    checkedAt: Date.now(),
    source: "runtime_tls",
    evidence: {
      rpcConfigured: false,
      tlsObserved: false
    }
  };
}

export function buildRpcFailureResult(
  context: BrowserRequestContext,
  certificate: CertificateObservation | null,
  matchedDomain: string | undefined,
  domainHash: `0x${string}` | undefined,
  rpcConfigured: boolean
): VerificationResult {
  return {
    tabId: context.tabId,
    url: context.url,
    hostname: context.hostname,
    normalizedDomain: context.normalizedDomain,
    matchedDomain,
    domainHash,
    certHash: certificate?.certHash,
    issuer: certificate?.issuer,
    subject: certificate?.subject,
    serialNumber: certificate?.serialNumber,
    certificateChain: certificate?.chain,
    status: "RPCFailure",
    message: "온체인 검증 상태를 확인할 수 없습니다.",
    checkedAt: Date.now(),
    source: "runtime_tls",
    evidence: {
      rpcConfigured,
      tlsObserved: Boolean(certificate)
    }
  };
}

export function buildTlsObservationFailureResult(
  context: BrowserRequestContext,
  matchedDomain: string | undefined,
  domainHash: `0x${string}` | undefined,
  rpcConfigured: boolean
): VerificationResult {
  return {
    tabId: context.tabId,
    url: context.url,
    hostname: context.hostname,
    normalizedDomain: context.normalizedDomain,
    matchedDomain,
    domainHash,
    status: "TLSObservationFailure",
    message: "현재 요청에서 HTTPS 인증서 정보를 읽을 수 없습니다.",
    checkedAt: Date.now(),
    source: "runtime_tls",
    evidence: {
      rpcConfigured,
      tlsObserved: false
    }
  };
}

export function buildVerificationResult(
  context: BrowserRequestContext,
  certificate: CertificateObservation,
  matchedDomain: string,
  domainHash: `0x${string}`,
  onChainStatus: CertificateStatusView,
  rpcConfigured: boolean
): VerificationResult {
  const baseResult = {
    tabId: context.tabId,
    url: context.url,
    hostname: context.hostname,
    normalizedDomain: context.normalizedDomain,
    matchedDomain,
    domainHash,
    certHash: certificate.certHash,
    checkedAt: Date.now(),
    issuer: certificate.issuer,
    subject: certificate.subject,
    serialNumber: certificate.serialNumber,
    certificateChain: certificate.chain,
    source: "runtime_tls" as const,
    evidence: {
      onChainStatus,
      rpcConfigured,
      tlsObserved: true,
      futureCtContext: {
        pendingCandidate: false
      }
    }
  };

  if (onChainStatus.revoked) {
    return {
      ...baseResult,
      status: "Revoked",
      message: "폐기된 인증서입니다."
    };
  }

  if (onChainStatus.approved && onChainStatus.exists) {
    return {
      ...baseResult,
      status: "Approved",
      message: "온체인 승인된 인증서입니다."
    };
  }

  return {
    ...baseResult,
    status: "Unapproved",
    message: "온체인 승인되지 않은 인증서입니다."
  };
}
