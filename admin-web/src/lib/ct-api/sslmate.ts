import type { SSLMateIssuanceEntry } from "../../types/admin";

const proxyBaseUrl = import.meta.env.VITE_CT_PROXY_URL ?? "/api/certspotter";

interface QuerySslmateOptions {
  includeSubdomains?: boolean;
  matchWildcards?: boolean;
  certHash?: string;
  maxPages?: number;
}

const DEFAULT_MAX_SSLMATE_PAGES = 2;

interface QuerySslmatePageOptions extends QuerySslmateOptions {
  after?: string;
  expandCertDer?: boolean;
}

function buildSslmateUrl(baseUrl: string = proxyBaseUrl): URL {
  const url = new URL(baseUrl, window.location.origin);
  return url;
}

async function parseSslmateJsonResponse(response: Response): Promise<SSLMateIssuanceEntry[]> {
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const retrySuffix = retryAfter ? ` Retry-After: ${retryAfter}s.` : "";
    throw new Error(`SSLMate rate limit reached.${retrySuffix}`);
  }

  if (!response.ok) {
    throw new Error(`SSLMate query failed with status ${response.status}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  const trimmed = text.trim();
  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) {
    const snippet = trimmed.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`SSLMate returned a non-JSON response. Response preview: ${snippet}`);
  }

  try {
    return JSON.parse(trimmed) as SSLMateIssuanceEntry[];
  } catch {
    throw new Error("SSLMate returned malformed JSON.");
  }
}

async function querySslmatePage(
  domain: string,
  options: QuerySslmatePageOptions = {}
): Promise<SSLMateIssuanceEntry[]> {
  const url = buildSslmateUrl();
  url.searchParams.set("domain", domain);
  url.searchParams.set("include_subdomains", options.includeSubdomains ? "true" : "false");
  url.searchParams.set("match_wildcards", options.matchWildcards ? "true" : "false");
  if (options.after) {
    url.searchParams.set("after", options.after);
  }
  url.searchParams.append("expand", "dns_names");
  url.searchParams.append("expand", "issuer");
  if (options.expandCertDer) {
    url.searchParams.append("expand", "cert_der");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  return parseSslmateJsonResponse(response);
}

export async function querySslmate(
  domain: string,
  options: QuerySslmateOptions = {}
): Promise<SSLMateIssuanceEntry[]> {
  const collectedEntries: SSLMateIssuanceEntry[] = [];
  const seenIds = new Set<string>();
  const normalizedCertHash = options.certHash?.trim().toLowerCase();
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_SSLMATE_PAGES);
  let after: string | undefined;
  let pageCount = 0;

  while (true) {
    let entries: SSLMateIssuanceEntry[];
    try {
      entries = await querySslmatePage(domain, {
        ...options,
        after
      });
    } catch (error) {
      if (collectedEntries.length > 0) {
        return collectedEntries;
      }

      throw error;
    }

    if (entries.length === 0) {
      break;
    }

    pageCount += 1;

    for (const entry of entries) {
      if (seenIds.has(entry.id)) {
        continue;
      }

      seenIds.add(entry.id);
      collectedEntries.push(entry);
    }

    if (
      normalizedCertHash &&
      entries.some(
        (entry) => entry.cert_sha256 && `0x${entry.cert_sha256.toLowerCase()}` === normalizedCertHash
      )
    ) {
      break;
    }

    const nextAfter = entries[entries.length - 1]?.id;
    if (!nextAfter || nextAfter === after || pageCount >= maxPages) {
      break;
    }

    after = nextAfter;
  }

  return collectedEntries;
}

export async function fetchSslmateCertificateDer(
  domain: string,
  issuanceId: string,
  options: QuerySslmateOptions = {}
): Promise<string> {
  let after: string | undefined;

  while (true) {
    const entries = await querySslmatePage(domain, {
      ...options,
      after,
      expandCertDer: true
    });

    if (entries.length === 0) {
      break;
    }

    const matched = entries.find((entry) => entry.id === issuanceId);
    if (matched?.cert_der) {
      return matched.cert_der;
    }

    after = entries[entries.length - 1]?.id;
  }

  throw new Error("선택한 인증서의 원문 DER를 SSLMate에서 가져오지 못했습니다.");
}
