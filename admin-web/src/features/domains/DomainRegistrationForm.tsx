import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import type { DomainFormState } from "../../types/admin";

const initialState: DomainFormState = {
  domain: "",
  ownerAddress: ""
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function DomainRegistrationForm() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [state, setState] = useState<DomainFormState>({
    ...initialState,
    ownerAddress: address ?? ""
  });
  const [submittedRegistrationKey, setSubmittedRegistrationKey] = useState("");
  const [submittedHash, setSubmittedHash] = useState<`0x${string}` | undefined>();
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  const normalizedDomain = normalizeDomain(state.domain);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : "";
  const ownerQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getDomainOwner",
    args: domainHash ? [domainHash as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(domainHash)
    }
  });
  const registrationKey = `${normalizedDomain}|${domainHash}|${state.ownerAddress.trim().toLowerCase()}`;
  const receiptQuery = useWaitForTransactionReceipt({
    hash: submittedHash,
    query: {
      enabled: Boolean(submittedHash)
    }
  });
  const ownerMatches =
    Boolean(address) &&
    Boolean(state.ownerAddress) &&
    (address?.toLowerCase() ?? "") === state.ownerAddress.toLowerCase();
  const registeredOwnerAddress =
    ownerQuery.data && Array.isArray(ownerQuery.data) && typeof ownerQuery.data[0] === "string"
      ? ownerQuery.data[0]
      : ZERO_ADDRESS;
  const isAlreadyRegistered =
    ownerQuery.data && Array.isArray(ownerQuery.data) && typeof ownerQuery.data[1] === "boolean"
      ? ownerQuery.data[1]
      : false;
  const isRegistrationLocked =
    Boolean(registrationKey) && submittedRegistrationKey === registrationKey;
  const isSubmitDisabled =
    isPending || receiptQuery.isLoading || !domainHash || isRegistrationLocked || isAlreadyRegistered;
  const submitLabel = isPending
    ? "등록 중..."
    : receiptQuery.isLoading
      ? "등록 확인 중..."
    : isAlreadyRegistered
      ? "이미 등록된 도메인입니다"
      : isRegistrationLocked
        ? "서명 완료"
        : "도메인 오너 등록";

  useEffect(() => {
    if (receiptQuery.isSuccess) {
      setSubmittedRegistrationKey(registrationKey);
      setShowRegistrationSuccess(true);
      setSubmittedHash(undefined);
    }
  }, [receiptQuery.isSuccess, registrationKey]);

  function shortenAddress(value?: string) {
    if (!value) {
      return "-";
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setShowRegistrationSuccess(false);

    const hash = await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "registerDomain",
      args: [normalizedDomain, domainHash as `0x${string}`, state.ownerAddress as `0x${string}`]
    });
    setSubmittedHash(hash);
  }

  return (
    <section className="domain-screen">
      <div className="domain-screen-header">
        <h1 className="domain-screen-title">도메인 소유권 등록</h1>
        <p className="domain-screen-subtitle">
          새 도메인과 운영 owner 주소를 CertificateRegistry에 등록합니다.
        </p>
      </div>

      <div className="domain-screen-grid">
        <form className="domain-card domain-form-card" onSubmit={onSubmit}>
          <div className="domain-card-copy">
            <h2 className="domain-card-title">도메인 등록</h2>
          </div>

          <div className="domain-field">
            <label htmlFor="domain">Domain</label>
            <input
              id="domain"
              placeholder="example.com"
              value={state.domain}
              onChange={(event) => setState((prev) => ({ ...prev, domain: event.target.value }))}
            />
          </div>

          <div className="domain-field">
            <label htmlFor="owner-address">Owner address</label>
            <input
              id="owner-address"
              placeholder="0x..."
              value={state.ownerAddress}
              onChange={(event) =>
                setState((prev) => ({ ...prev, ownerAddress: event.target.value }))
              }
            />
          </div>

          <div className="domain-preview-card">
            <p className="domain-preview-title">{normalizedDomain || "example.com"}</p>

            <div className="domain-preview-row">
              <span className="domain-preview-label">domainHash</span>
              <span className="domain-preview-value mono">{domainHash || "-"}</span>
            </div>

            <div className="domain-preview-row">
              <span className="domain-preview-label">ownerAddress</span>
              <span className="domain-preview-value mono">{state.ownerAddress || "-"}</span>
            </div>

            {isAlreadyRegistered && (
              <div className="domain-preview-row">
                <span className="domain-preview-label">registered owner</span>
                <span className="domain-preview-value mono">{registeredOwnerAddress}</span>
              </div>
            )}

            {(ownerMatches || domainHash) && (
              <div className="domain-owner-chip-row">
                {ownerMatches && (
                  <span className="domain-owner-chip">OWNER = CONNECTED WALLET</span>
                )}
                {domainHash && !isAlreadyRegistered && (
                  <span className="domain-owner-chip">
                    {ownerQuery.isLoading
                      ? "CHECKING ON-CHAIN..."
                      : "READY TO REGISTER"}
                  </span>
                )}
              </div>
            )}
          </div>

          <button className="domain-submit-button" disabled={isSubmitDisabled}>
            {submitLabel}
          </button>
        </form>

        <div className="domain-side-stack">
          <article className="domain-card domain-summary-card">
            <h2 className="domain-summary-title">등록 전 확인</h2>

            <div className="domain-summary-grid">
              <span className="domain-summary-label">Network</span>
              <span className="domain-summary-value">Sepolia</span>

              <span className="domain-summary-label">Contract</span>
              <span className="domain-summary-value mono">{shortenAddress(registryAddress)}</span>

              <span className="domain-summary-label">Caller</span>
              <span className="domain-summary-value mono">{shortenAddress(address)}</span>
            </div>
          </article>

          <article className="domain-limit-card">
            <p className="domain-limit-title">DNS 검증 상태</p>
            <p className="domain-limit-copy">
              현재 구현 범위에는 DNS TXT 기반 domain ownership verification이 포함되지 않습니다.
            </p>
            <span className="domain-limit-pill">LIMITATION</span>
          </article>
        </div>
      </div>

      {showRegistrationSuccess && (
        <div className="domain-success-popup-backdrop" role="presentation">
          <div
            className="domain-success-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="domain-success-title"
            aria-describedby="domain-success-copy"
          >
            <h2 id="domain-success-title" className="domain-success-popup-title">
              등록 완료
            </h2>
            <p id="domain-success-copy" className="domain-success-popup-copy">
              등록이 완료됐습니다.
            </p>
            <button
              type="button"
              className="domain-success-popup-button"
              onClick={() => setShowRegistrationSuccess(false)}
            >
              완료
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
