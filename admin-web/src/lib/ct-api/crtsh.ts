import type { CrtShRawEntry } from "../../types/admin";

const proxyBaseUrl = import.meta.env.VITE_CT_PROXY_URL ?? "/api/crtsh/";

interface QueryCrtShOptions {
  includeSubdomains?: boolean;
}

function buildCrtShUrl(
  searchParams: Record<string, string>,
  baseUrl: string = proxyBaseUrl
): string {
  const url = new URL(baseUrl, window.location.origin);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function queryCrtSh(
  domain: string,
  options: QueryCrtShOptions = {}
): Promise<CrtShRawEntry[]> {
  const queryValue = options.includeSubdomains ? `%.${domain}` : domain;
  const searchUrl = buildCrtShUrl({
    q: queryValue,
    match: options.includeSubdomains ? "LIKE" : "=",
    output: "json",
    exclude: "expired"
  });

  const response = await fetch(searchUrl, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`crt.sh query failed with status ${response.status}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  const trimmed = text.trim();
  const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");

  if (!looksLikeJson) {
    const snippet = trimmed.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      `crt.sh returned a non-JSON response. Upstream may be unstable or the query may be too broad. Response preview: ${snippet}`
    );
  }

  try {
    return JSON.parse(trimmed) as CrtShRawEntry[];
  } catch {
    throw new Error(
      "crt.sh returned malformed JSON. Upstream response format may have changed or the proxy returned a partial response."
    );
  }
}
