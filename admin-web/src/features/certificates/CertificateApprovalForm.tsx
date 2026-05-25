import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Search, SearchCheck, X } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import {
  buildDomainCandidates,
  deriveDomainHash,
  normalizeDomain
} from "../../lib/domain/hash";
import { querySslmate } from "../../lib/ct-api/sslmate";
import { normalizeGroupedSslmateEntries } from "../../lib/ct-api/normalize";
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

function normalizeCertHashInput(value: string): string {
  const compact = value.trim().toLowerCase();
  if (!compact) {
    return "";
  }

  return compact.startsWith("0x") ? compact : `0x${compact}`;
}

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

function mergeSearchResults(items: CrtSearchResultItem[]): CrtSearchResultItem[] {
  const merged = new Map<string, CrtSearchResultItem>();

  for (const item of items) {
    const key = `${item.externalId}:${item.certHash}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, {
      ...existing,
      identities: Array.from(new Set([...existing.identities, ...item.identities])),
      wildcard: existing.wildcard || item.wildcard,
      exactMatch: existing.exactMatch || item.exactMatch,
      reviewState:
        existing.reviewState === "Pending" || item.reviewState === "Pending"
          ? "Pending"
          : "Needs Review"
    });
  }

  return Array.from(merged.values());
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
  const [searchCertHash, setSearchCertHash] = useState("");
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [activeResultsTab, setActiveResultsTab] = useState<SearchResultTab>("active");

  const normalizedDomain = useMemo(() => normalizeDomain(state.domain), [state.domain]);
  const normalizedSearchDomain = useMemo(() => normalizeDomain(searchDomain), [searchDomain]);
  const searchDomainCandidates = useMemo(
    () => buildDomainCandidates(normalizedSearchDomain),
    [normalizedSearchDomain]
  );
  const domainHash = useMemo(
    () =>
      normalizedDomain
        ? deriveDomainHash(registryChainId, normalizedDomain)
        : ("" as `0x${string}` | ""),
    [normalizedDomain]
  );
  const normalizedSearchCertHash = useMemo(
    () => normalizeCertHashInput(searchCertHash),
    [searchCertHash]
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
  const filteredActiveResults = useMemo(
    () =>
      activeResults.filter((item) =>
        normalizedSearchCertHash
          ? item.certHash.toLowerCase() === normalizedSearchCertHash
          : true
      ),
    [activeResults, normalizedSearchCertHash]
  );
  const filteredUpcomingResults = useMemo(
    () =>
      upcomingResults.filter((item) =>
        normalizedSearchCertHash
          ? item.certHash.toLowerCase() === normalizedSearchCertHash
          : true
      ),
    [normalizedSearchCertHash, upcomingResults]
  );
  const visibleResults =
    activeResultsTab === "active" ? filteredActiveResults : filteredUpcomingResults;
  const totalResultPages = useMemo(
    () => Math.max(1, Math.ceil(visibleResults.length / resultsPerPage)),
    [visibleResults.length]
  );
  const pagedSearchResults = useMemo(() => {
    const startIndex = (resultsPage - 1) * resultsPerPage;
    return visibleResults.slice(startIndex, startIndex + resultsPerPage);
  }, [resultsPage, visibleResults]);
  const selectionNeedsReview = Boolean(
    selectedSearchResult &&
      (selectedSearchResult.wildcard ||
        selectedSearchResult.reviewState === "Needs Review" ||
        !selectedSearchResult.exactMatch)
  );

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
      const groupedEntries = await Promise.all(
        searchDomainCandidates.map((domainCandidate) =>
          querySslmate(domainCandidate, {
            includeSubdomains,
            matchWildcards,
            certHash: normalizedSearchCertHash || undefined
          })
        )
      );
      const normalizedResults = mergeSearchResults(
        groupedEntries
          .flatMap((entries) =>
            normalizeGroupedSslmateEntries(searchDomainCandidates, entries)
          )
          .filter(isSearchResultUsable)
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

  function resetSelectedCertificate() {
    setState(initialState);
    setSelectedSearchResult(null);
  }

  return (
    <section className="approval-screen">
      <div className="approval-screen-header">
        <h1 className="approval-screen-title">인증서 승인</h1>
        <p className="approval-screen-subtitle">
          승인할 인증서를 검색하고 선택한 뒤 온체인 승인할 수 있습니다.
        </p>
      </div>

      <div className="approval-main-card">
        {!isApprovalReady ? (
          <div className="approval-empty-layout">
            <div className="approval-empty-header">
              <h2 className="approval-section-title">승인할 인증서 선택</h2>
              <p className="approval-section-copy">
                SSLMate 인증서 검색을 통해 승인 대상 인증서를 먼저 선택하세요.
              </p>
            </div>

            <div className="approval-empty-card">
              <div className="approval-empty-state">
                <div className="approval-empty-icon">
                  <Search size={20} strokeWidth={2.2} />
                </div>
                <div className="approval-empty-copy">
                  <p className="approval-empty-title">선택된 인증서가 없습니다.</p>
                  <p className="approval-empty-description">
                    검색 결과에서 인증서를 선택하면 검토 상태와 승인 요청 정보가 표시됩니다.
                  </p>
                </div>
              </div>

              <button
                className="approval-search-button"
                onClick={() => setIsSearchModalOpen(true)}
                type="button"
              >
                <Search size={15} strokeWidth={2.2} />
                인증서 검색
              </button>
            </div>

            <div className="approval-request-info">
              <div className="approval-request-info-copy">
                <h3 className="approval-request-title">승인 요청 정보</h3>
                <p className="approval-request-description">
                  인증서를 선택하면 아래 정보가 자동으로 채워집니다.
                </p>
              </div>

              <div className="approval-placeholder-grid">
                <PlaceholderField label="Domain" value="—" />
                <PlaceholderField label="domainHash" value="—" mono tone="accent" />
                <PlaceholderField label="certHash" value="—" mono tone="accent" />
                <PlaceholderField label="Approver" value="—" mono tone="accent" />
              </div>

              <div className="approval-placeholder-block">
                <span className="approval-placeholder-label">Memo</span>
                <div className="approval-placeholder-area">
                  인증서를 선택한 뒤 승인 메모를 입력할 수 있습니다.
                </div>
              </div>

              <button className="approval-submit-disabled" disabled type="button">
                온체인 승인
              </button>
            </div>
          </div>
        ) : (
          <form className="approval-selected-layout" onSubmit={onSubmit}>
            <div className="approval-empty-header">
              <h2 className="approval-section-title">선택한 인증서</h2>
              <p className="approval-section-copy">
                선택된 인증서 정보와 승인 메모를 확인한 뒤 온체인 승인합니다.
              </p>
            </div>

            <div className="approval-selected-grid">
              <div className="approval-selected-card-wrap">
                {selectedSearchResult && (
                  <SearchResultCard
                    item={selectedSearchResult}
                    onReset={resetSelectedCertificate}
                    selected
                  />
                )}
              </div>

              <aside
                className={
                  selectionNeedsReview
                    ? "approval-review-card approval-review-card-warning"
                    : "approval-review-card approval-review-card-ready"
                }
              >
                <span className="approval-review-pill">
                  {selectionNeedsReview ? "NEEDS REVIEW" : "REVIEW READY"}
                </span>
                <h3 className="approval-review-title">
                  {selectionNeedsReview
                    ? "와일드카드 또는 수동 검토 대상입니다."
                    : "현재 선택한 인증서는 승인 준비 상태입니다."}
                </h3>
                <p className="approval-review-copy">
                  {selectionNeedsReview
                    ? "도메인 일치 방식, wildcard 포함 여부, subject 정보를 검토한 뒤 온체인 승인하세요."
                    : "도메인, certHash, subject, 유효기간을 검토한 뒤 승인 메모와 함께 온체인에 등록할 수 있습니다."}
                </p>
                {selectedSearchResult && (
                  <div className="approval-review-meta">
                    <ReviewMeta label="Review State" value={selectedSearchResult.reviewState} />
                    <ReviewMeta
                      label="Wildcard"
                      value={selectedSearchResult.wildcard ? "Included" : "Not included"}
                    />
                    <ReviewMeta
                      label="Validity"
                      value={formatValidityRange(
                        selectedSearchResult.validFrom,
                        selectedSearchResult.validTo
                      )}
                    />
                  </div>
                )}
              </aside>
            </div>

            <div className="approval-request-info">
              <div className="approval-request-info-copy">
                <h3 className="approval-request-title">승인 요청 정보</h3>
                <p className="approval-request-description">
                  검색으로 선택된 인증서 데이터를 기반으로 approval transaction을 구성합니다.
                </p>
              </div>

              <div className="approval-placeholder-grid">
                <PlaceholderField label="Domain" value={state.domain || "-"} />
                <PlaceholderField
                  label="domainHash"
                  value={domainHash || "-"}
                  mono
                  tone="accent"
                />
                <PlaceholderField
                  className="approval-placeholder-field-wide"
                  label="certHash"
                  value={state.certHash || "-"}
                  mono
                  tone="accent"
                />
                <PlaceholderField
                  className="approval-placeholder-field-wide"
                  label="Approver"
                  value={address || "-"}
                  mono
                  tone="accent"
                />
              </div>

              <div className="approval-placeholder-block">
                <label className="approval-placeholder-label" htmlFor="approval-memo">
                  Memo
                </label>
                <textarea
                  className="approval-memo-area"
                  id="approval-memo"
                  placeholder="온체인에 남길 승인 메모를 입력하세요."
                  value={state.memo}
                  onChange={(event) => update("memo", event.target.value)}
                />
              </div>

              <button
                className="approval-submit-button"
                disabled={isPending || !domainHash || !state.certHash}
              >
                {isPending ? "인증서 승인 중..." : "인증서 승인"}
              </button>
            </div>
          </form>
        )}
      </div>

      {isSearchModalOpen &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setIsSearchModalOpen(false)}>
            <div className="approval-modal-panel" onClick={(event) => event.stopPropagation()}>
              <div className="approval-modal-header">
                <div className="approval-modal-title-wrap">
                  <h2 className="approval-modal-title">인증서 검색</h2>
                </div>
                <button
                  className="approval-modal-close"
                  onClick={() => setIsSearchModalOpen(false)}
                  type="button"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>

              <div className="approval-modal-search-row">
                <div className="approval-modal-search-field">
                  <label className="approval-modal-label" htmlFor="certificate-search-domain">
                    Domain Search
                  </label>
                  <input
                    className="approval-modal-input"
                    id="certificate-search-domain"
                    placeholder="example.com"
                    value={searchDomain}
                    onChange={(event) => setSearchDomain(event.target.value)}
                  />
                </div>
                <button
                  className="approval-modal-search-button"
                  disabled={isSearching || !normalizedSearchDomain}
                  onClick={handleSearch}
                  type="button"
                >
                  <Search size={16} strokeWidth={2.3} />
                  <span>{isSearching ? "검색 중..." : "검색"}</span>
                </button>
              </div>

              <div className="approval-advanced-block">
                <button
                  className={`approval-advanced-toggle ${isAdvancedSearchOpen ? "approval-advanced-toggle-open" : ""}`}
                  onClick={() => setIsAdvancedSearchOpen((open) => !open)}
                  type="button"
                >
                  <span className="approval-advanced-toggle-icon">
                    {isAdvancedSearchOpen ? "⌃" : "⌄"}
                  </span>
                  <span className="approval-advanced-toggle-copy">고급 옵션</span>
                  <span className="approval-advanced-toggle-description">
                    certHash 및 검색 범위 필터
                  </span>
                  <span className="approval-advanced-toggle-icon">
                    {isAdvancedSearchOpen ? "−" : "+"}
                  </span>
                </button>

                {isAdvancedSearchOpen && (
                  <div className="approval-advanced-panel">
                    <div className="approval-cert-filter-row">
                      <div className="approval-modal-search-field">
                        <div className="approval-filter-label-row">
                          <label
                            className="approval-modal-label"
                            htmlFor="certificate-search-cert-hash"
                          >
                            certHash Filter
                          </label>
                          <p className="approval-filter-note">
                            {normalizedSearchCertHash
                              ? `현재 certHash 필터와 일치하는 결과만 표시합니다.`
                              : "certHash를 입력하면 검색 결과 중 정확히 일치하는 인증서만 남길 수 있습니다."}
                          </p>
                        </div>
                        <input
                          className="approval-modal-input"
                          id="certificate-search-cert-hash"
                          placeholder="0x... extension에서 확인한 certHash"
                          value={searchCertHash}
                          onChange={(event) => setSearchCertHash(event.target.value)}
                        />
                      </div>
                      <button
                        className="approval-cert-filter-refresh"
                        onClick={() => setSearchCertHash(state.certHash)}
                        type="button"
                      >
                        <RefreshCw size={14} strokeWidth={2.2} />
                      </button>
                    </div>

                    <div className="approval-toggle-grid">
                      <label className="approval-toggle-card">
                        <input
                          checked={includeSubdomains}
                          onChange={(event) => setIncludeSubdomains(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Include subdomains</span>
                      </label>

                      <label className="approval-toggle-card">
                        <input
                          checked={matchWildcards}
                          onChange={(event) => setMatchWildcards(event.target.checked)}
                          type="checkbox"
                        />
                        <span>Match wildcards</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {searchError && (
                <div className="approval-search-error">
                  <p className="approval-search-error-title">검색 중 오류가 발생했습니다.</p>
                  <p className="approval-search-error-copy">{searchError}</p>
                  <button
                    className="approval-filter-action"
                    disabled={isSearching || !normalizedSearchDomain}
                    onClick={handleSearch}
                    type="button"
                  >
                    {isSearching ? "재시도 중..." : "검색 재시도"}
                  </button>
                </div>
              )}

              <div className="approval-modal-results-bar">
                <div className="approval-modal-results-copy">
                  <p className="approval-modal-results-title">검색 결과</p>
                  <p className="approval-modal-results-meta">
                    {searchResults.length === 0
                      ? "검색 결과가 없습니다."
                      : `${visibleResults.length}개 결과`}
                  </p>
                </div>
                <div className="approval-modal-pagination">
                  <span className="approval-pagination-status">
                    {resultsPage} / {totalResultPages} 페이지
                  </span>
                  <button
                    className="approval-pagination-button"
                    disabled={resultsPage === 1}
                    onClick={() => setResultsPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    이전
                  </button>
                  <button
                    className="approval-pagination-button"
                    disabled={resultsPage === totalResultPages}
                    onClick={() => setResultsPage((page) => Math.min(totalResultPages, page + 1))}
                    type="button"
                  >
                    다음
                  </button>
                </div>
              </div>

              {normalizedSearchDomain && (
                <div className="approval-domain-candidates">{searchDomainCandidates.join(" / ")}</div>
              )}

              <div className="approval-tab-row">
                <button
                  className={`approval-tab-button ${activeResultsTab === "active" ? "approval-tab-button-active" : ""}`}
                  onClick={() => {
                    setActiveResultsTab("active");
                    setResultsPage(1);
                  }}
                  type="button"
                >
                  <span>현재 유효</span>
                  <span>{filteredActiveResults.length}</span>
                </button>
                <button
                  className={`approval-tab-button ${activeResultsTab === "upcoming" ? "approval-tab-button-active" : ""}`}
                  onClick={() => {
                    setActiveResultsTab("upcoming");
                    setResultsPage(1);
                  }}
                  type="button"
                >
                  <span>유효 예정</span>
                  <span>{filteredUpcomingResults.length}</span>
                </button>
              </div>

              <div className="approval-results-grid">
                {visibleResults.length === 0 ? (
                  <div className="approval-results-empty">
                    {searchResults.length === 0
                      ? "domain을 입력하고 인증서 검색을 실행하세요."
                      : normalizedSearchCertHash
                        ? "입력한 certHash와 정확히 일치하는 검색 결과가 없습니다."
                        : activeResultsTab === "active"
                          ? "현재 유효한 검색 결과가 없습니다."
                          : "예정된 검색 결과가 없습니다."}
                  </div>
                ) : (
                  pagedSearchResults.map((item) => (
                    <SearchResultCard
                      key={item.id}
                      item={item}
                      highlighted={
                        normalizedSearchCertHash
                          ? item.certHash.toLowerCase() === normalizedSearchCertHash
                          : false
                      }
                      selected={selectedSearchResult?.id === item.id}
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

function PlaceholderField(props: {
  className?: string;
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "accent";
}) {
  return (
    <div className={["approval-placeholder-field", props.className ?? ""].filter(Boolean).join(" ")}>
      <span className="approval-placeholder-label">{props.label}</span>
      <div
        className={[
          "approval-placeholder-input",
          props.mono ? "approval-placeholder-input-mono" : "",
          props.tone === "accent" ? "approval-placeholder-input-accent" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {props.value}
      </div>
    </div>
  );
}

function ReviewMeta(props: { label: string; value: string }) {
  return (
    <div className="approval-review-meta-row">
      <span className="approval-review-meta-label">{props.label}</span>
      <span className="approval-review-meta-value">{props.value}</span>
    </div>
  );
}

function SearchResultCard(props: {
  item: CrtSearchResultItem;
  highlighted?: boolean;
  onReset?: () => void;
  selected?: boolean;
  onSelect?: (item: CrtSearchResultItem) => void;
}) {
  const cardClassName = [
    "approval-result-card",
    props.selected ? "approval-result-card-selected" : "",
    props.highlighted ? "approval-result-card-highlighted" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <h3 className="approval-result-domain">{props.item.domain || "-"}</h3>

      {props.highlighted && (
        <div className="approval-result-callout">
          extension에서 입력한 certHash와 일치하는 인증서입니다.
        </div>
      )}

      <div className="approval-result-details">
        <SearchEntry label="Issuer" value={props.item.issuer || "-"} strong />
        <SearchEntry label="certHash" value={props.item.certHash || "-"} accent mono />
        <div className="approval-result-dates">
          <SearchEntry label="Valid from" value={formatDisplayDate(props.item.validFrom)} />
          <SearchEntry label="Valid to" value={formatDisplayDate(props.item.validTo)} />
        </div>
        <SearchEntry
          label="Identities"
          value={props.item.identities.length === 0 ? "-" : props.item.identities.join(", ")}
        />
      </div>

      {props.item.wildcard && (
        <div className="approval-result-warning">
          Wildcard certificate입니다. exact domain-only 기준이라면 수동 검토가 필요합니다.
        </div>
      )}

      <div className="approval-result-footer">
        <p className="approval-result-external">{normalizeExternalLabel(props.item.externalLabel)}</p>
        {props.onSelect ? (
          <button
            className={props.selected ? "approval-result-select active" : "approval-result-select"}
            onClick={() => props.onSelect?.(props.item)}
            type="button"
          >
            {props.selected ? "선택됨" : "선택"}
          </button>
        ) : props.onReset ? (
          <button className="approval-result-select" onClick={props.onReset} type="button">
            선택 초기화
          </button>
        ) : (
          <span className="approval-selected-chip">
            <SearchCheck size={14} strokeWidth={2.2} />
            선택됨
          </span>
        )}
      </div>
    </article>
  );
}

function SearchEntry(props: {
  label: string;
  value: string;
  accent?: boolean;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="approval-result-entry">
      <p className="approval-result-label">{props.label}</p>
      <p
        className={[
          "approval-result-entry-value",
          props.accent ? "approval-result-entry-value-accent" : "",
          props.strong ? "approval-result-entry-value-strong" : "",
          props.mono ? "approval-result-entry-value-mono" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {props.value}
      </p>
    </div>
  );
}

function formatDisplayDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatValidityRange(validFrom: string, validTo: string) {
  return `${formatDisplayDate(validFrom)} - ${formatDisplayDate(validTo)}`;
}

function normalizeExternalLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
