import type { SSLMateIssuanceEntry } from "../../types/admin";

const proxyBaseUrl = import.meta.env.VITE_CT_PROXY_URL ?? "/api/certspotter";

interface QuerySslmateOptions {
  includeSubdomains?: boolean;
  matchWildcards?: boolean;
}

interface QuerySslmatePageOptions extends QuerySslmateOptions {
  after?: string;
  expandCertDer?: boolean;
}

function buildSslmateUrl(baseUrl: string = proxyBaseUrl): URL {
  const url = new URL(baseUrl, window.location.origin);
  return url;
}

async function parseSslmateJsonResponse(response: Response): Promise<SSLMateIssuanceEntry[]> {
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
  return querySslmatePage(domain, options);
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
