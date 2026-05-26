import { useEffect, useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";
import type { Abi, Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import { fetchRegisteredDomainsForAddress } from "../../lib/chain/registered-domains";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import type { CertificateStatusView } from "../../types/admin";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type RevocationRow = {
  domainHash: `0x${string}`;
  certHash: `0x${string}`;
  displayDomain: string;
  domain: string;
  ownerMatches: boolean;
  status: CertificateStatusView;
};

type RegisteredDomainEntry = {
  domainHash: string;
  domain: string;
};

export function RevocationPanel() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [domainInput, setDomainInput] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [selectedCertHash, setSelectedCertHash] = useState<`0x${string}` | "">("");
  const [memo, setMemo] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [submittedHash, setSubmittedHash] = useState<`0x${string}` | undefined>();
  const [showRevocationSuccess, setShowRevocationSuccess] = useState(false);
  const [registeredDomains, setRegisteredDomains] = useState<RegisteredDomainEntry[]>([]);
  const [registeredDomainsLoading, setRegisteredDomainsLoading] = useState(false);

  const normalizedInput = useMemo(() => normalizeDomain(domainInput), [domainInput]);
  const normalizedDomain = useMemo(() => normalizeDomain(searchedDomain), [searchedDomain]);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : undefined;
  const connectedAddress = (address ?? ZERO_ADDRESS).toLowerCase();
  const activeDomainSources = useMemo(
    () =>
      searchedDomain
        ? [
            {
              domain: searchedDomain,
              domainHash: domainHash as `0x${string}`
            }
          ]
        : registeredDomains.map((entry) => ({
            domain: entry.domain,
            domainHash: entry.domainHash as `0x${string}`
          })),
    [domainHash, registeredDomains, searchedDomain]
  );

  const ownerContracts = useMemo(
    () =>
      activeDomainSources.map((entry) => ({
        address: registryAddress,
        abi: registryAbi as Abi,
        functionName: "getDomainOwner" as const,
        args: [entry.domainHash] as const
      })),
    [activeDomainSources]
  );

  const ownerQueries = useReadContracts({
    contracts: ownerContracts,
    query: {
      enabled: ownerContracts.length > 0
    }
  });

  const ownerStatusByDomainHash = useMemo(() => {
    const map = new Map<string, { exists: boolean; ownerMatches: boolean }>();

    activeDomainSources.forEach((entry, index) => {
      const result = ownerQueries.data?.[index];
      const ownerData =
        result && result.status === "success" && Array.isArray(result.result) ? result.result : [];
      const ownerAddress = typeof ownerData[0] === "string" ? ownerData[0].toLowerCase() : ZERO_ADDRESS;
      const exists = typeof ownerData[1] === "boolean" ? ownerData[1] : false;

      map.set(entry.domainHash, {
        exists,
        ownerMatches: exists && ownerAddress === connectedAddress
      });
    });

    return map;
  }, [activeDomainSources, connectedAddress, ownerQueries.data]);

  const approvedHashesContracts = useMemo(
    () =>
      activeDomainSources.map((entry) => ({
        address: registryAddress,
        abi: registryAbi as Abi,
        functionName: "getApprovedCertificates" as const,
        args: [entry.domainHash] as const
      })),
    [activeDomainSources]
  );

  const approvedHashesQuery = useReadContracts({
    contracts: approvedHashesContracts,
    query: {
      enabled: approvedHashesContracts.length > 0
    }
  });

  const approvedCertPairs = useMemo(
    () =>
      activeDomainSources.flatMap((entry, index) => {
        const result = approvedHashesQuery.data?.[index];
        const certHashes =
          result && result.status === "success" && Array.isArray(result.result)
            ? (result.result as `0x${string}`[])
            : [];

        return certHashes.map((certHash) => ({
          domain: entry.domain,
          domainHash: entry.domainHash,
          certHash
        }));
      }),
    [activeDomainSources, approvedHashesQuery.data]
  );

  const statusContracts = useMemo(
    () =>
      approvedCertPairs.map((entry) => ({
            address: registryAddress,
            abi: registryAbi as Abi,
            functionName: "getCertificateStatus" as const,
            args: [entry.domainHash, entry.certHash] as const
          })),
    [approvedCertPairs]
  );

  const statusesQuery = useReadContracts({
    contracts: statusContracts,
    query: {
      enabled: statusContracts.length > 0
    }
  });

  const rows = useMemo<RevocationRow[]>(
    () =>
      approvedCertPairs
        .map((entry, index) => {
          const result = statusesQuery.data?.[index];
          if (!result || result.status !== "success") return null;

          const status = result.result as CertificateStatusView;
          if (!status.approved || status.revoked) return null;

          const ownerStatus = ownerStatusByDomainHash.get(entry.domainHash);
          if (!ownerStatus?.ownerMatches) return null;

          return {
            domainHash: entry.domainHash,
            certHash: entry.certHash,
            displayDomain: extractDisplayDomain(status.subject, entry.domain),
            domain: entry.domain,
            ownerMatches: Boolean(ownerStatus.ownerMatches),
            status
          };
        })
        .filter((entry): entry is RevocationRow => entry !== null),
    [approvedCertPairs, ownerStatusByDomainHash, statusesQuery.data]
  );

  const selectedRow = rows.find((row) => row.certHash === selectedCertHash) ?? null;
  const hasError = Boolean(ownerQueries.error || approvedHashesQuery.error || statusesQuery.error);
  const isLoading =
    registeredDomainsLoading ||
    ownerQueries.isLoading ||
    approvedHashesQuery.isLoading ||
    statusesQuery.isLoading;
  const revocationReceiptQuery = useWaitForTransactionReceipt({
    hash: submittedHash,
    query: {
      enabled: Boolean(submittedHash)
    }
  });

  useEffect(() => {
    if (!selectedCertHash) return;
    if (!rows.some((row) => row.certHash === selectedCertHash)) {
      setSelectedCertHash("");
    }
  }, [rows, selectedCertHash]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRow || !selectedRow.ownerMatches) return;

    setShowRevocationSuccess(false);

    const hash = await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "revokeCertificate",
      args: [selectedRow.domainHash, selectedRow.certHash, memo]
    });
    setSubmittedHash(hash);
  }

  function handleSearch() {
    if (!normalizedInput) return;

    setSelectedCertHash("");
    setMemo("");
    setSearchedDomain(normalizedInput);
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

  useEffect(() => {
    let cancelled = false;

    async function loadRegisteredDomains() {
      if (!publicClient || !address) {
        setRegisteredDomains([]);
        setRegisteredDomainsLoading(false);
        return;
      }

      setRegisteredDomainsLoading(true);

      try {
        const nextRegisteredDomains = await fetchRegisteredDomainsForAddress(
          publicClient,
          address as Address
        );

        if (!cancelled) {
          setRegisteredDomains(nextRegisteredDomains);
        }
      } catch {
        if (!cancelled) {
          setRegisteredDomains([]);
        }
      } finally {
        if (!cancelled) {
          setRegisteredDomainsLoading(false);
        }
      }
    }

    void loadRegisteredDomains();

    return () => {
      cancelled = true;
    };
  }, [address, publicClient]);

  useEffect(() => {
    if (revocationReceiptQuery.isSuccess) {
      setShowRevocationSuccess(true);
      setSubmittedHash(undefined);
    }
  }, [revocationReceiptQuery.isSuccess]);

  return (
    <section className="revocation-screen">
      <div className="revocation-screen-copy">
        <h1 className="revocation-screen-title">인증 취소</h1>
        <p className="revocation-screen-subtitle">
          이 계정으로 승인한 인증서 중 취소할 대상을 선택하고 온체인 인증 취소를 실행합니다.
        </p>
      </div>

      <div className="revocation-account-card">
        <div className="revocation-account-icon">
          <Copy size={16} strokeWidth={2.1} />
        </div>
        <p className="revocation-account-address">{address || "-"}</p>
        <button className="revocation-account-copy" onClick={copyConnectedAddress} type="button">
          {copiedAddress ? "복사됨" : "복사"}
        </button>
      </div>

      <form className="revocation-screen-layout" onSubmit={onSubmit}>
        <section className="revocation-list-card">
          <div className="revocation-list-header">
            <div>
              <h2 className="revocation-list-title">승인한 인증서 목록</h2>
              <p className="revocation-list-copy">인증 취소 대상을 선택하세요</p>
            </div>
          </div>

          <div className="revocation-search-row">
            <label className="revocation-search-label" htmlFor="revocation-domain-search">
              <Search size={13} strokeWidth={2.1} />
              도메인 검색
            </label>
            <input
              className="revocation-search-input"
              id="revocation-domain-search"
              placeholder="example.com"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
            />
            <button
              className="revocation-search-button"
              disabled={!normalizedInput}
              onClick={handleSearch}
              type="button"
            >
              검색
            </button>
          </div>

          {searchedDomain &&
            domainHash &&
            !ownerQueries.isLoading &&
            ownerStatusByDomainHash.has(domainHash) &&
            !ownerStatusByDomainHash.get(domainHash)?.ownerMatches && (
            <div className="revocation-owner-warning">
              {ownerStatusByDomainHash.get(domainHash)?.exists
                ? "현재 연결된 owner 지갑과 도메인 owner가 일치하지 않아 인증 취소를 실행할 수 없습니다."
                : "등록된 owner가 없는 도메인입니다."}
            </div>
          )}

          <div className="revocation-table-wrap">
            <div className="revocation-table-head">
              <span>certHash · ID</span>
              <span>인증서 / Issuer</span>
              <span>유효기간</span>
              <span>온체인 상태</span>
              <span>작업</span>
            </div>

            {!searchedDomain && !registeredDomainsLoading && rows.length === 0 && (
              <div className="revocation-empty-state">
                이 지갑으로 인증 취소 가능한 승인 인증서가 없습니다.
              </div>
            )}

            {searchedDomain && !domainHash && (
              <div className="revocation-empty-state">
                취소할 인증서를 조회할 도메인을 먼저 검색하세요.
              </div>
            )}

            {(searchedDomain ? Boolean(domainHash) : activeDomainSources.length > 0) && isLoading && (
              <div className="revocation-empty-state">
                승인된 인증서 목록을 불러오는 중입니다.
              </div>
            )}

            {(searchedDomain ? Boolean(domainHash) : activeDomainSources.length > 0) && hasError && (
              <div className="revocation-empty-state revocation-empty-state-error">
                온체인 조회 중 오류가 발생했습니다. 잠시 후 다시 검색해 주세요.
              </div>
            )}

            {searchedDomain && !isLoading && !hasError && rows.length === 0 && (
              <div className="revocation-empty-state">
                이 도메인에 등록된 승인 인증서가 없습니다.
              </div>
            )}

            {!isLoading && !hasError && rows.length > 0 && (
              <table className="revocation-table">
                <colgroup>
                  <col className="revocation-col-hash" />
                  <col className="revocation-col-cert" />
                  <col className="revocation-col-validity" />
                  <col className="revocation-col-status" />
                  <col className="revocation-col-action" />
                </colgroup>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      className={`revocation-table-row ${selectedCertHash === row.certHash ? "revocation-table-row-selected" : ""}`}
                      key={`${row.domainHash}:${row.certHash}`}
                    >
                      <td className="revocation-table-cell revocation-hash-cell">
                        <span className="revocation-hash-value">
                          {formatHashPreview(row.certHash)}
                        </span>
                      </td>
                      <td className="revocation-table-cell revocation-cert-column">
                        <div className="revocation-cert-cell">
                          <strong>{row.displayDomain}</strong>
                          <span>{row.status.issuer || "-"}</span>
                        </div>
                      </td>
                      <td className="revocation-table-cell revocation-date-cell">
                        {formatValidityRange(row.status.validFrom, row.status.validTo)}
                      </td>
                      <td className="revocation-table-cell revocation-status-column">
                        <span className="revocation-status-chip">APPROVED</span>
                      </td>
                      <td className="revocation-table-cell revocation-action-column">
                        <button
                          className={`revocation-select-button ${selectedCertHash === row.certHash ? "revocation-select-button-active" : ""}`}
                          onClick={() => setSelectedCertHash(row.certHash)}
                          type="button"
                        >
                          {selectedCertHash === row.certHash ? "선택됨" : "선택"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="revocation-action-card">
          <div className="revocation-action-header">
            <h2 className="revocation-action-title">선택한 인증서 인증 취소</h2>
          </div>

          <div className="revocation-selected-summary">
            <span className="revocation-selected-hash">
              {selectedRow ? formatHashPreview(selectedRow.certHash) : "-"}
            </span>
            <span className="revocation-selected-meta">
              {selectedRow
                ? `${selectedRow.displayDomain} · ${selectedRow.status.issuer || "-"}`
                : "인증 취소할 인증서를 먼저 선택하세요."}
            </span>
          </div>

          <div className="revocation-memo-layout">
            <div className="revocation-memo-field">
              <label className="revocation-memo-label" htmlFor="revocation-memo">
                인증 취소 메모
              </label>
              <input
                className="revocation-memo-input"
                id="revocation-memo"
                placeholder="Key compromise suspected · rotate certificate"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
              />
            </div>

            <div className="revocation-warning-box">
              인증 취소된 인증서는 검증 과정에서 승인되지 않은 인증서로 처리될 수 있습니다.
            </div>
          </div>

          <button
            className="revocation-submit-button"
            disabled={
              isPending ||
              revocationReceiptQuery.isLoading ||
              !selectedRow ||
              !selectedRow.ownerMatches
            }
            type="submit"
          >
            {isPending
              ? "인증 취소 중..."
              : revocationReceiptQuery.isLoading
                ? "취소 확인 중..."
                : "인증 취소 실행"}
          </button>
        </section>
      </form>

      {showRevocationSuccess && (
        <div className="txn-success-popup-backdrop" role="presentation">
          <div
            className="txn-success-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revocation-success-title"
            aria-describedby="revocation-success-copy"
          >
            <h2 id="revocation-success-title" className="txn-success-popup-title">
              인증 취소 완료
            </h2>
            <p id="revocation-success-copy" className="txn-success-popup-copy">
              인증 취소가 완료됐습니다.
            </p>
            <button
              type="button"
              className="txn-success-popup-button"
              onClick={() => setShowRevocationSuccess(false)}
            >
              완료
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function extractDisplayDomain(subject: string, fallback: string) {
  const normalizedSubject = subject.trim().toLowerCase();
  const subjectDomain = normalizedSubject.match(/(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0];

  return subjectDomain || fallback || "unknown";
}

function formatHashPreview(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
