import { useMemo, useState } from "react";
import { Ban } from "lucide-react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";
import type { CertificateStatusView } from "../../types/admin";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function RevocationPanel() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [domainInput, setDomainInput] = useState("");
  const [searchedDomain, setSearchedDomain] = useState("");
  const [selectedCertHash, setSelectedCertHash] = useState<`0x${string}` | "">("");
  const [memo, setMemo] = useState("");

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

  const ownerAddress =
    typeof ownerQuery.data === "string" ? ownerQuery.data.toLowerCase() : ZERO_ADDRESS;
  const connectedAddress = (address ?? ZERO_ADDRESS).toLowerCase();
  const hasRegisteredOwner = ownerAddress !== ZERO_ADDRESS;
  const ownerMatches = hasRegisteredOwner && connectedAddress === ownerAddress;
  const approvedHashes = Array.isArray(approvedHashesQuery.data)
    ? (approvedHashesQuery.data as `0x${string}`[])
    : [];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!domainHash || !selectedCertHash || !ownerMatches) return;

    await writeContractAsync({
      address: registryAddress,
      abi: registryAbi,
      functionName: "revokeCertificate",
      args: [domainHash, selectedCertHash, memo]
    });
  }

  function handleSearch() {
    setSelectedCertHash("");
    setSearchedDomain(domainInput);
  }

  return (
    <section className="glass p-6">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Revoke Certificate
        </p>
        <div className="module-title-row">
          <span className="module-icon-badge">
            <Ban size={18} strokeWidth={2.2} />
          </span>
          <h2 className="m-0 text-xl font-semibold">Revocation Flow</h2>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="revocation-domain">Domain</label>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              id="revocation-domain"
              placeholder="example.com"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
            />
            <button
              className="btn btn-primary self-end"
              disabled={!normalizeDomain(domainInput)}
              onClick={handleSearch}
              type="button"
            >
              검색
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">domainHash</p>
            <p className="mono m-0 text-sm break-all">{domainHash ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Owner Check</p>
            <p className="m-0 text-sm">
              {!domainHash
                ? "도메인을 입력하세요."
                : ownerQuery.isLoading
                  ? "owner 확인 중..."
                  : !hasRegisteredOwner
                    ? "등록된 owner가 없습니다."
                    : ownerMatches
                      ? "현재 연결된 지갑이 owner와 일치합니다."
                      : "현재 연결된 지갑이 owner와 일치하지 않습니다."}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {!domainHash && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              폐기할 도메인을 먼저 입력하면 승인된 인증서 목록을 조회합니다.
            </div>
          )}

          {domainHash && approvedHashesQuery.isLoading && (
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 text-sm text-slate-500">
              승인된 인증서 목록을 불러오는 중입니다.
            </div>
          )}

          {domainHash && (ownerQuery.error || approvedHashesQuery.error) && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              온체인 조회 중 오류가 발생했습니다. 잠시 후 다시 검색해 주세요.
            </div>
          )}

          {domainHash && !ownerQuery.error && !approvedHashesQuery.error && !approvedHashesQuery.isLoading && approvedHashes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              이 도메인에 등록된 승인 인증서가 없습니다.
            </div>
          )}

          {!ownerQuery.error && !approvedHashesQuery.error && approvedHashes.length > 0 && (
            <div className="grid gap-4">
              <p className="mb-0 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                폐기할 인증서 선택
              </p>
              <div className="grid gap-4">
                {approvedHashes.map((certHash) => (
                  <RevocationCertificateCard
                    key={certHash}
                    certHash={certHash}
                    domainHash={domainHash as `0x${string}`}
                    selected={selectedCertHash === certHash}
                    onSelect={setSelectedCertHash}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Selected certHash</p>
            <p className="mono m-0 text-sm break-all">{selectedCertHash || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Connected Approver</p>
            <p className="mono m-0 text-sm break-all">{address || "-"}</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="revocation-memo">Memo</label>
          <textarea
            id="revocation-memo"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        <button
          className="btn btn-secondary"
          disabled={isPending || !domainHash || !selectedCertHash || !ownerMatches}
        >
          {isPending ? "폐기 중..." : "온체인 폐기"}
        </button>
      </form>
    </section>
  );
}

function RevocationCertificateCard(props: {
  domainHash: `0x${string}`;
  certHash: `0x${string}`;
  selected: boolean;
  onSelect: (certHash: `0x${string}`) => void;
}) {
  const query = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getCertificateStatus",
    args: [props.domainHash, props.certHash]
  });

  const status = query.data as CertificateStatusView | undefined;
  const selectable = Boolean(status?.approved) && !status?.revoked;

  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/75 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          <span className={`status-chip ${status?.revoked ? "status-revoked" : "status-approved"}`}>
            {status?.revoked ? "Revoked" : status?.approved ? "Approved" : "Unknown"}
          </span>
          <p className="mono m-0 text-sm break-all font-semibold">{props.certHash}</p>
        </div>

        <button
          className="btn btn-secondary"
          disabled={!selectable}
          onClick={() => props.onSelect(props.certHash)}
          type="button"
        >
          {props.selected ? "선택됨" : "폐기할 인증서 선택"}
        </button>
      </div>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">인증서 상태를 조회하는 중입니다.</p>
      ) : status ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <RevocationDetail label="Issuer" value={status.issuer} />
          <RevocationDetail label="Subject" value={status.subject} />
          <RevocationDetail label="Serial Number" value={status.serialNumber} />
          <RevocationDetail label="Memo" value={status.memo} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">온체인 상태를 찾지 못했습니다.</p>
      )}
    </article>
  );
}

function RevocationDetail(props: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="m-0 text-sm break-all">{props.value || "-"}</p>
    </div>
  );
}
