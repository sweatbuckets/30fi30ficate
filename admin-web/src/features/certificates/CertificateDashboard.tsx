import { Fragment, useEffect, useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";
import type { Abi, Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import { fetchRegisteredDomainsForAddress } from "../../lib/chain/registered-domains";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import type { CertificateStatusView } from "../../types/admin";

const PAGE_SIZE = 4;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EXPIRING_SOON_DAYS = 30;

type DashboardRow = {
  certHash: `0x${string}`;
  displayDomain: string;
  status: CertificateStatusView;
  expiringSoon: boolean;
};

type RegisteredDomainEntry = {
  domainHash: string;
  domain: string;
};

export function CertificateDashboard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [domainInput, setDomainInput] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCertHash, setExpandedCertHash] = useState<`0x${string}` | "">("");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [registeredDomainCount, setRegisteredDomainCount] = useState(0);
  const [registeredDomainCountLoading, setRegisteredDomainCountLoading] = useState(false);
  const [registeredDomains, setRegisteredDomains] = useState<RegisteredDomainEntry[]>([]);

  const normalizedInput = useMemo(() => normalizeDomain(domainInput), [domainInput]);
  const normalizedDomain = useMemo(() => normalizeDomain(searchedDomain), [searchedDomain]);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : undefined;

  const ownerQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getDomainOwner",
    args: domainHash ? [domainHash] : undefined,
    query: {
      enabled: Boolean(domainHash)
    }
  });

  const approvedHashesQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getApprovedCertificates",
    args: domainHash ? [domainHash] : undefined,
    query: {
      enabled: Boolean(domainHash)
    }
  });

  const approvedHashes = Array.isArray(approvedHashesQuery.data)
    ? (approvedHashesQuery.data as `0x${string}`[])
    : [];
  const ownerAddress =
    ownerQuery.data && Array.isArray(ownerQuery.data) && typeof ownerQuery.data[0] === "string"
      ? ownerQuery.data[0].toLowerCase()
      : ZERO_ADDRESS;
  const hasRegisteredOwner =
    ownerQuery.data && Array.isArray(ownerQuery.data) && typeof ownerQuery.data[1] === "boolean"
      ? ownerQuery.data[1]
      : false;

  const statusContracts = useMemo(
    () =>
      domainHash
        ? approvedHashes.map((certHash) => ({
            address: registryAddress,
            abi: registryAbi as Abi,
            functionName: "getCertificateStatus" as const,
            args: [domainHash, certHash] as const
          }))
        : [],
    [approvedHashes, domainHash]
  );

  const statusesQuery = useReadContracts({
    contracts: statusContracts,
    query: {
      enabled: statusContracts.length > 0
    }
  });

  const dashboardRows = useMemo<DashboardRow[]>(
    () =>
      approvedHashes
        .map((certHash, index) => {
          const result = statusesQuery.data?.[index];
          if (!result || result.status !== "success") return null;

          const status = result.result as CertificateStatusView;

          return {
            certHash,
            displayDomain: extractDisplayDomain(status.subject, normalizedDomain),
            status,
            expiringSoon: isExpiringSoon(status)
          };
        })
        .filter((entry): entry is DashboardRow => entry !== null),
    [approvedHashes, normalizedDomain, statusesQuery.data]
  );

  const approvedCount = dashboardRows.filter(
    (entry) => entry.status.approved && !entry.status.revoked
  ).length;
  const revokedCount = dashboardRows.filter((entry) => entry.status.revoked).length;
  const expiringSoonCount = dashboardRows.filter((entry) => entry.expiringSoon).length;
  const totalPages = Math.max(1, Math.ceil(dashboardRows.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = dashboardRows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!expandedCertHash) return;
    if (!visibleRows.some((row) => row.certHash === expandedCertHash)) {
      setExpandedCertHash("");
    }
  }, [expandedCertHash, visibleRows]);

  useEffect(() => {
    let cancelled = false;

    async function loadRegisteredDomainCount() {
      if (!publicClient || !address) {
        setRegisteredDomainCount(0);
        setRegisteredDomainCountLoading(false);
        setRegisteredDomains([]);
        return;
      }

      setRegisteredDomainCountLoading(true);

      try {
        const nextRegisteredDomains = await fetchRegisteredDomainsForAddress(
          publicClient,
          address as Address
        );

        if (!cancelled) {
          setRegisteredDomainCount(nextRegisteredDomains.length);
          setRegisteredDomains(nextRegisteredDomains);
        }
      } catch {
        if (!cancelled) {
          setRegisteredDomainCount(0);
          setRegisteredDomains([]);
        }
      } finally {
        if (!cancelled) {
          setRegisteredDomainCountLoading(false);
        }
      }
    }

    void loadRegisteredDomainCount();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  function handleSearch(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!normalizedInput) return;

    setSearchedDomain(normalizedInput);
    setCurrentPage(1);
    setExpandedCertHash("");
  }

  async function copyConnectedAddress() {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 1600);
    } catch {
      setCopiedAddress(false);
    }
  }

  const hasSearchResult = Boolean(domainHash);
  const isLoading =
    ownerQuery.isLoading || approvedHashesQuery.isLoading || statusesQuery.isLoading;
  const hasError = Boolean(ownerQuery.error || approvedHashesQuery.error || statusesQuery.error);
  const visibleStart = dashboardRows.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + visibleRows.length, dashboardRows.length);

  return (
    <section className="dashboard-screen">
      <div className="dashboard-screen-header">
        <div className="dashboard-screen-copy">
          <h1 className="dashboard-screen-title">승인 인증서 대시보드</h1>
          <p className="dashboard-screen-subtitle">
            도메인별 온체인 승인 및 폐기 상태를 조회합니다.
          </p>
        </div>

        <div className="dashboard-account-card">
          <div className="dashboard-account-icon">
            <Copy size={16} strokeWidth={2.1} />
          </div>
          <p className="dashboard-account-address">{address || "-"}</p>
          <button
            className="dashboard-account-copy"
            onClick={copyConnectedAddress}
            type="button"
          >
            {copiedAddress ? "복사됨" : "복사"}
          </button>
        </div>
      </div>

      <div className="dashboard-metric-grid">
        <SummaryCard
          label="등록 도메인"
          value={registeredDomainCount}
          tone="primary"
          meta={
            !address
              ? "wallet required"
              : registeredDomainCountLoading
                ? "checking on-chain"
                : registeredDomainCount > 0
                  ? `${registeredDomainCount} registered`
                  : "not registered"
          }
        />
        <SummaryCard
          label="승인 인증서"
          value={dashboardRows.length}
          tone="success"
          meta={`${approvedCount} active`}
        />
        <SummaryCard
          label="폐기됨"
          value={revokedCount}
          tone="danger"
          meta={revokedCount > 0 ? `${revokedCount} revoked` : "none revoked"}
        />
        <SummaryCard
          label="만료 임박"
          value={expiringSoonCount}
          tone="warning"
          meta={expiringSoonCount > 0 ? "≤ 30 days" : "stable"}
        />
      </div>

      <form className="dashboard-search-bar" onSubmit={handleSearch}>
        <label className="dashboard-search-label" htmlFor="dashboard-domain-search">
          <Search size={13} strokeWidth={2.1} />
          도메인 검색
        </label>
        <input
          className="dashboard-search-input"
          id="dashboard-domain-search"
          placeholder="example.com"
          value={domainInput}
          onChange={(event) => setDomainInput(event.target.value)}
        />
        <button className="dashboard-search-button" disabled={!normalizedInput} type="submit">
          <Search size={14} strokeWidth={2.1} />
          검색
        </button>
      </form>

      <section className="dashboard-registered-domains-card">
        <div className="dashboard-registered-domains-head">
          <h2 className="dashboard-registered-domains-title">등록 도메인 목록</h2>
          <span className="dashboard-registered-domains-meta">
            {registeredDomainCountLoading
              ? "불러오는 중"
              : `${registeredDomains.length} domains`}
          </span>
        </div>

        {registeredDomains.length === 0 ? (
          <div className="dashboard-registered-domains-empty">
            {address
              ? "현재 연결된 지갑으로 등록한 도메인이 없습니다."
              : "지갑을 연결하면 등록 도메인 목록을 확인할 수 있습니다."}
          </div>
        ) : (
          <div className="dashboard-registered-domains-list">
            {registeredDomains.map((entry) => (
              <button
                key={entry.domainHash}
                className={`dashboard-registered-domain-chip ${normalizedDomain === normalizeDomain(entry.domain) ? "active" : ""}`}
                onClick={() => {
                  setDomainInput(entry.domain);
                  setSearchedDomain(entry.domain);
                  setCurrentPage(1);
                  setExpandedCertHash("");
                }}
                type="button"
              >
                <span className="dashboard-registered-domain-name">{entry.domain}</span>
                <span className="dashboard-registered-domain-hash">{formatHashPreview(entry.domainHash)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-table-card">
        <div className="dashboard-table-head">
          <span>certHash</span>
          <span>인증서 / Issuer</span>
          <span>유효기간</span>
          <span>온체인 상태</span>
          <span>작업</span>
        </div>

        {!hasSearchResult && (
          <div className="dashboard-empty-state">이 지갑에 등록된 승인 인증서가 없습니다.</div>
        )}

        {hasSearchResult && isLoading && (
          <div className="dashboard-empty-state">온체인 인증서 상태를 불러오는 중입니다.</div>
        )}

        {hasSearchResult && hasError && (
          <div className="dashboard-empty-state dashboard-empty-state-error">
            온체인 조회 중 오류가 발생했습니다. 잠시 후 다시 검색해 주세요.
          </div>
        )}

        {hasSearchResult && !isLoading && !hasError && dashboardRows.length === 0 && (
          <div className="dashboard-empty-state">
            이 도메인에 등록된 승인 인증서가 없습니다.
          </div>
        )}

        {hasSearchResult && !isLoading && !hasError && dashboardRows.length > 0 && (
          <>
            <table className="dashboard-table">
              <tbody>
                {visibleRows.map((row) => {
                  const expanded = expandedCertHash === row.certHash;
                  const statusTone = row.status.revoked ? "revoked" : "approved";
                  const statusLabel = row.status.revoked ? "REVOKED" : "APPROVED";

                  return (
                    <Fragment key={row.certHash}>
                      <tr className="dashboard-table-row" key={row.certHash}>
                        <td className="dashboard-hash-cell">
                          <span className="dashboard-hash-value">
                            {formatHashPreview(row.certHash)}
                          </span>
                        </td>
                        <td>
                          <div className="dashboard-cert-cell">
                            <strong>{row.displayDomain}</strong>
                            <span>{row.status.issuer || "-"}</span>
                          </div>
                        </td>
                        <td className="dashboard-date-cell">
                          {formatValidityRange(row.status.validFrom, row.status.validTo)}
                        </td>
                        <td>
                          <span className={`dashboard-status-chip dashboard-status-chip-${statusTone}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <button
                            className="dashboard-row-action"
                            onClick={() =>
                              setExpandedCertHash(expanded ? "" : row.certHash)
                            }
                            type="button"
                          >
                            {expanded ? "닫기" : "상세"}
                            <span>›</span>
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="dashboard-detail-row">
                          <td colSpan={5}>
                            <div className="dashboard-detail-panel">
                              <DetailCell label="Full certHash" value={row.certHash} mono />
                              <DetailCell label="domainHash" value={domainHash || "-"} mono />
                              <DetailCell label="Subject" value={row.status.subject || "-"} />
                              <DetailCell
                                label="Serial Number"
                                value={row.status.serialNumber || "-"}
                              />
                              <DetailCell label="Memo" value={row.status.memo || "-"} />
                              <DetailCell
                                label="Approved At"
                                value={formatStatusTimestamp(row.status.approvedAt)}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="dashboard-table-footer">
              <p className="dashboard-table-count">
                총 {dashboardRows.length}건 중 {visibleStart}–{visibleEnd}건 표시
              </p>

              <div className="dashboard-pagination">
                <button
                  className="dashboard-page-button dashboard-page-button-wide"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  이전
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    className={`dashboard-page-button ${page === currentPage ? "dashboard-page-button-active" : ""}`}
                    onClick={() => setCurrentPage(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}

                <button
                  className="dashboard-page-button dashboard-page-button-wide"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryCard(props: {
  label: string;
  value: number;
  meta: string;
  tone: "primary" | "success" | "danger" | "warning";
}) {
  return (
    <article className="dashboard-summary-card">
      <p className="dashboard-summary-label">{props.label}</p>
      <p className="dashboard-summary-value">{props.value}</p>
      <span className={`dashboard-summary-meta dashboard-summary-meta-${props.tone}`}>
        {props.meta}
      </span>
    </article>
  );
}

function DetailCell(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="dashboard-detail-cell">
      <span className="dashboard-detail-label">{props.label}</span>
      <span
        className={`dashboard-detail-value ${props.mono ? "dashboard-detail-value-mono" : ""}`}
      >
        {props.value}
      </span>
    </div>
  );
}

function formatHashPreview(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function extractDisplayDomain(subject: string, fallback: string) {
  const normalizedSubject = subject.trim().toLowerCase();
  const subjectDomain = normalizedSubject.match(/(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0];

  return subjectDomain || fallback || "unknown";
}

function bigintToDate(value: bigint) {
  if (value <= 0n) return null;
  return new Date(Number(value) * 1000);
}

function formatDate(value: bigint) {
  const date = bigintToDate(value);
  if (!date) return "-";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function formatValidityRange(validFrom: bigint, validTo: bigint) {
  return `${formatDate(validFrom)} ~ ${formatDate(validTo)}`;
}

function formatStatusTimestamp(value: bigint) {
  const date = bigintToDate(value);
  if (!date) return "-";

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function isExpiringSoon(status: CertificateStatusView) {
  if (!status.approved || status.revoked) return false;

  const validTo = bigintToDate(status.validTo);
  if (!validTo) return false;

  const threshold = Date.now() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
  return validTo.getTime() <= threshold;
}
