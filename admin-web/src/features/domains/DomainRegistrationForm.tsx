import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import type { DomainFormState } from "../../types/admin";

const initialState: DomainFormState = {
  domain: "",
  ownerAddress: ""
};

export function DomainRegistrationForm() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [state, setState] = useState<DomainFormState>({
    ...initialState,
    ownerAddress: address ?? ""
  });

  const normalizedDomain = normalizeDomain(state.domain);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : "";
  const ownerMatches =
    Boolean(address) &&
    Boolean(state.ownerAddress) &&
    (address?.toLowerCase() ?? "") === state.ownerAddress.toLowerCase();

  function shortenAddress(value?: string) {
    if (!value) {
      return "-";
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "registerDomain",
      args: [normalizedDomain, domainHash as `0x${string}`, state.ownerAddress as `0x${string}`]
    });
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
            <h2 className="domain-card-title">Register a domain</h2>
            <p className="domain-card-kicker">WRITE · registerDomain()</p>
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

            {ownerMatches && (
              <span className="domain-owner-chip">OWNER = CONNECTED WALLET</span>
            )}
          </div>

          <button className="domain-submit-button" disabled={isPending || !domainHash}>
            {isPending ? "등록 중..." : "도메인 오너 등록"}
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

              <span className="domain-summary-label">Function</span>
              <span className="domain-summary-value">registerDomain()</span>
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
    </section>
  );
}
