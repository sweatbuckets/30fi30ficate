import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SearchCheck } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import { querySslmate } from "../../lib/ct-api/sslmate";
import { normalizeSslmateEntries } from "../../lib/ct-api/normalize";
import type { ApprovalFormState, CrtSearchResultItem } from "../../types/admin";

const initialState: ApprovalFormState = {
  domain: "",
  certHash: "",
  issuer: "",
  subject: "",
  serialNumber: "",
  validFrom: "",
  validTo: "",
  memo: ""
};

const resultsPerPage = 20;

type SearchResultTab = "active" | "upcoming";

function isSearchResultUsable(item: CrtSearchResultItem): boolean {
  const now = Date.now();
  const validFrom = item.validFrom ? Date.parse(item.validFrom) : Number.NaN;
  const validTo = item.validTo ? Date.parse(item.validTo) : Number.NaN;

  if (Number.isNaN(validFrom) || Number.isNaN(validTo)) {
    return false;
  }

  if (item.revoked === true) {
    return false;
  }

  if (item.reviewState === "Rejected") {
    return false;
  }

  return now <= validTo;
}

function isCurrentlyValidResult(item: CrtSearchResultItem): boolean {
  const now = Date.now();
  const validFrom = item.validFrom ? Date.parse(item.validFrom) : Number.NaN;
  const validTo = item.validTo ? Date.parse(item.validTo) : Number.NaN;

  if (Number.isNaN(validFrom) || Number.isNaN(validTo)) {
    return false;
  }

  return validFrom <= now && now <= validTo;
}

function isUpcomingResult(item: CrtSearchResultItem): boolean {
  const now = Date.now();
  const validFrom = item.validFrom ? Date.parse(item.validFrom) : Number.NaN;

  if (Number.isNaN(validFrom)) {
    return false;
  }

  return validFrom > now;
}

export function CertificateApprovalForm() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [state, setState] = useState<ApprovalFormState>(initialState);
  const [selectedSearchResult, setSelectedSearchResult] = useState<CrtSearchResultItem | null>(null);
  const [searchDomain, setSearchDomain] = useState("");
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [matchWildcards, setMatchWildcards] = useState(false);
  const [searchResults, setSearchResults] = useState<CrtSearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [activeResultsTab, setActiveResultsTab] = useState<SearchResultTab>("active");

  const normalizedDomain = useMemo(() => normalizeDomain(state.domain), [state.domain]);
  const normalizedSearchDomain = useMemo(() => normalizeDomain(searchDomain), [searchDomain]);
  const domainHash = useMemo(
    () =>
      normalizedDomain
        ? deriveDomainHash(registryChainId, normalizedDomain)
        : ("" as `0x${string}` | ""),
    [normalizedDomain]
  );
  const isApprovalReady = Boolean(
    state.domain ||
      state.certHash ||
      state.issuer ||
      state.subject ||
      state.serialNumber ||
      state.validFrom ||
      state.validTo ||
      state.memo
  );
  const activeResults = useMemo(
    () => searchResults.filter(isCurrentlyValidResult),
    [searchResults]
  );
  const upcomingResults = useMemo(
    () => searchResults.filter(isUpcomingResult),
    [searchResults]
  );
  const visibleResults = activeResultsTab === "active" ? activeResults : upcomingResults;
  const totalResultPages = useMemo(
    () => Math.max(1, Math.ceil(visibleResults.length / resultsPerPage)),
    [visibleResults.length]
  );
  const pagedSearchResults = useMemo(() => {
    const startIndex = (resultsPage - 1) * resultsPerPage;
    return visibleResults.slice(startIndex, startIndex + resultsPerPage);
  }, [resultsPage, visibleResults]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "approveCertificate",
      args: [
        domainHash as `0x${string}`,
        state.certHash as `0x${string}`,
        state.issuer,
        state.subject,
        state.serialNumber,
        BigInt(state.validFrom || "0"),
        BigInt(state.validTo || "0"),
        "SHA-256",
        state.memo
      ]
    });
  }

  async function handleSearch() {
    if (!normalizedSearchDomain) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const entries = await querySslmate(normalizedSearchDomain, {
        includeSubdomains,
        matchWildcards
      });
      const normalizedResults = normalizeSslmateEntries(normalizedSearchDomain, entries).filter(
        isSearchResultUsable
      );
      setSearchResults(normalizedResults);
      setActiveResultsTab("active");
      setResultsPage(1);
    } catch (caught) {
      setSearchError(
        caught instanceof Error
          ? caught.message
          : "SSLMate search failed. Check upstream availability."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function selectSearchResult(item: CrtSearchResultItem) {
    setSelectedSearchResult(item);
    setState((current) => ({
      ...current,
      domain: item.domain,
      certHash: item.certHash,
      issuer: item.issuer,
      subject: item.subject,
      serialNumber: item.serialNumber,
      validFrom: item.validFrom ? String(Math.floor(Date.parse(item.validFrom) / 1000)) : "",
      validTo: item.validTo ? String(Math.floor(Date.parse(item.validTo) / 1000)) : "",
      memo: `Selected from SSLMate search (${item.externalId})`
    }));
    setIsSearchModalOpen(false);
  }

  return (
    <section className="glass p-6">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Certificate Approval
        </p>
        <div className="module-title-row">
          <span className="module-icon-badge">
            <SearchCheck size={18} strokeWidth={2.2} />
          </span>
          <h2 className="m-0 text-xl font-semibold">Certificate Approval</h2>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          SSLMate 검색 결과를 보고 승인할 인증서를 선택하거나, 필요하면 메타데이터와 certHash를 직접 입력해 온체인 approve 흐름으로 보냅니다.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-600">
          <span>
            SSLMate에서 인증서를 검색하고 결과를 선택하면 approval form이 활성화됩니다.
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setIsSearchModalOpen(true)}
            type="button"
          >
            인증서 검색
          </button>
        </div>

        {!isApprovalReady ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            아직 선택된 인증서가 없습니다. `인증서 검색`에서 결과를 고른 뒤 approval form을 진행하세요.
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={onSubmit}>
            {selectedSearchResult && (
              <div className="grid gap-3">
                <p className="mb-0 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  선택한 인증서
                </p>
                <SearchResultCard item={selectedSearchResult} />
              </div>
            )}

            <div className="flex items-center justify-end gap-4">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setState(initialState);
                  setSelectedSearchResult(null);
                }}
                type="button"
              >
                선택 초기화
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Domain</p>
                <p className="m-0 text-sm break-all font-medium text-slate-900">{state.domain || "-"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">domainHash</p>
                <p className="mono m-0 text-sm break-all text-slate-900">{domainHash || "-"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">certHash</p>
                <p className="mono m-0 text-sm break-all text-slate-900">{state.certHash || "-"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Approver</p>
                <p className="mono m-0 text-sm break-all text-slate-900">{address || "-"}</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="approval-memo">Memo</label>
              <textarea
                id="approval-memo"
                value={state.memo}
                onChange={(event) => update("memo", event.target.value)}
              />
            </div>

            <button className="btn btn-primary" disabled={isPending || !domainHash || !state.certHash}>
              {isPending ? "승인 중..." : "온체인 승인"}
            </button>
          </form>
        )}
      </div>

      {isSearchModalOpen &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setIsSearchModalOpen(false)}>
            <div className="modal-panel glass" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    SSLMate 인증서 검색
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsSearchModalOpen(false)}
                  type="button"
                >
                  닫기
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="field">
                  <label htmlFor="certificate-search-domain">Domain Search</label>
                  <input
                    id="certificate-search-domain"
                    placeholder="example.com"
                    value={searchDomain}
                    onChange={(event) => setSearchDomain(event.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary self-end"
                  disabled={isSearching || !normalizedSearchDomain}
                  onClick={handleSearch}
                  type="button"
                >
                  {isSearching ? "검색 중..." : "검색"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
                  <input
                    checked={includeSubdomains}
                    onChange={(event) => setIncludeSubdomains(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Include subdomains</span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
                  <input
                    checked={matchWildcards}
                    onChange={(event) => setMatchWildcards(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Match wildcards</span>
                </label>
              </div>

              {searchError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="m-0">{searchError}</p>
                  <div className="mt-3">
                    <button
                      className="btn btn-secondary"
                      disabled={isSearching || !normalizedSearchDomain}
                      onClick={handleSearch}
                      type="button"
                    >
                      {isSearching ? "재시도 중..." : "검색 재시도"}
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-summary">
                <span>
                  {searchResults.length === 0
                    ? "검색 결과가 없습니다."
                    : `총 ${searchResults.length}개 결과, ${resultsPage} / ${totalResultPages} 페이지`}
                </span>
                <div className="modal-pagination">
                  <button
                    className="btn btn-secondary"
                    disabled={resultsPage === 1}
                    onClick={() => setResultsPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    이전
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={resultsPage === totalResultPages}
                    onClick={() => setResultsPage((page) => Math.min(totalResultPages, page + 1))}
                    type="button"
                  >
                    다음
                  </button>
                </div>
              </div>

              {normalizedSearchDomain && (
                <div className="search-domain-heading">{normalizedSearchDomain}</div>
              )}

              <div className="menu-bar menu-bar-filters">
                <button
                  className={`menu-tab menu-tab-filter ${activeResultsTab === "active" ? "menu-tab-active" : ""}`}
                  onClick={() => {
                    setActiveResultsTab("active");
                    setResultsPage(1);
                  }}
                  type="button"
                >
                  지금 사용 가능 {activeResults.length}
                </button>
                <button
                  className={`menu-tab menu-tab-filter ${activeResultsTab === "upcoming" ? "menu-tab-active" : ""}`}
                  onClick={() => {
                    setActiveResultsTab("upcoming");
                    setResultsPage(1);
                  }}
                  type="button"
                >
                  곧 사용 가능 {upcomingResults.length}
                </button>
              </div>

              <div className="modal-results modal-results-spaced">
                {visibleResults.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                    {searchResults.length === 0
                      ? "domain을 입력하고 `Search SSLMate`를 실행하세요."
                      : activeResultsTab === "active"
                        ? "지금 사용 가능한 검색 결과가 없습니다."
                        : "곧 사용 가능해질 검색 결과가 없습니다."}
                  </div>
                ) : (
                  pagedSearchResults.map((item) => (
                    <SearchResultCard
                      key={item.id}
                      item={item}
                      onSelect={selectSearchResult}
                    />
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );

  function update<Key extends keyof ApprovalFormState>(key: Key, value: ApprovalFormState[Key]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }
}

function SearchResultCard(props: {
  item: CrtSearchResultItem;
  onSelect?: (item: CrtSearchResultItem) => void;
}) {
  const chipClassName =
    props.item.reviewState === "Rejected" ? "status-revoked" : "status-pending";

  return (
    <article className="search-result-card flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white/75 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="issuer-pill">{props.item.issuer}</span>
          <p className="search-result-hash m-0 text-lg break-all font-semibold">{props.item.certHash || "-"}</p>
        </div>
        <span className={`status-chip ${chipClassName}`}>{props.item.reviewState}</span>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Identities</p>
        <p className="m-0 text-sm break-all leading-6">
          {props.item.identities.length === 0
            ? "-"
            : props.item.identities.map((identity, index) => (
                <span
                  key={`${props.item.id}:${identity}:${index}`}
                  className={identity === props.item.domain ? "matched-identity" : "text-slate-600"}
                >
                  {index > 0 ? ", " : ""}
                  {identity}
                </span>
              ))}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <SearchEntry label="Subject" value={props.item.subject || "-"} />
        <div className="grid gap-3 grid-cols-2">
          <SearchEntry label="validFrom" value={props.item.validFrom || "-"} />
          <SearchEntry label="validTo" value={props.item.validTo || "-"} />
        </div>
      </div>

      <div className="mt-auto pt-5">
        {props.item.wildcard && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Wildcard certificate입니다. exact domain-only 정책 기준으로는 추가 검토가 필요합니다.
          </div>
        )}

        <div className="flex items-end justify-between gap-4">
          <p className="external-label m-0 text-xs text-slate-500">{props.item.externalLabel}</p>
          {props.onSelect ? (
            <button className="btn btn-secondary" onClick={() => props.onSelect?.(props.item)} type="button">
              인증서 선택
            </button>
          ) : (
            <span className="selected-certificate-chip">선택됨</span>
          )}
        </div>
      </div>
    </article>
  );
}

function SearchEntry(props: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="m-0 text-sm break-all">{props.value}</p>
    </div>
  );
}
