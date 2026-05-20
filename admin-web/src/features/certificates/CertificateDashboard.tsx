import { useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { useReadContract } from "wagmi";
import { registryAbi, registryAddress, registryChainId } from "../../lib/chain/contract";
import { deriveDomainHash, normalizeDomain } from "../../lib/domain/hash";

export function CertificateDashboard() {
  const [domain, setDomain] = useState("");
  const normalizedDomain = useMemo(() => normalizeDomain(domain), [domain]);
  const domainHash = normalizedDomain
    ? deriveDomainHash(registryChainId, normalizedDomain)
    : undefined;

  const approvedHashesQuery = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getApprovedCertificates",
    args: domainHash ? [domainHash] : undefined,
    query: {
      enabled: Boolean(domainHash)
    }
  });

  const approvedHashes = (approvedHashesQuery.data as `0x${string}`[] | undefined) ?? [];

  return (
    <section className="glass p-6">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Dashboard
        </p>
        <div className="module-title-row">
          <span className="module-icon-badge">
            <LayoutDashboard size={18} strokeWidth={2.2} />
          </span>
          <h2 className="m-0 text-xl font-semibold">Approved Certificate Dashboard</h2>
        </div>
      </div>

      <div className="field">
        <label htmlFor="dashboard-domain">Domain</label>
        <input
          id="dashboard-domain"
          placeholder="example.com"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
        <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">domainHash</p>
        <p className="mono text-sm break-all">{domainHash ?? "-"}</p>
      </div>

      <div className="mt-6 grid gap-4">
        {!domainHash && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            조회할 도메인을 입력하면 `getApprovedCertificates()` 결과를 표시합니다.
          </div>
        )}

        {approvedHashesQuery.isLoading && <DashboardCard title="Loading">Fetching on-chain cert hashes...</DashboardCard>}

        {approvedHashes.map((certHash) => (
          <CertificateStatusCard
            key={certHash}
            certHash={certHash}
            domainHash={domainHash as `0x${string}`}
          />
        ))}
      </div>
    </section>
  );
}

function CertificateStatusCard(props: {
  domainHash: `0x${string}`;
  certHash: `0x${string}`;
}) {
  const query = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getCertificateStatus",
    args: [props.domainHash, props.certHash]
  });

  const status = query.data as
    | {
        revoked: boolean;
        approved: boolean;
        issuer: string;
        subject: string;
        serialNumber: string;
        validFrom: bigint;
        validTo: bigint;
        memo: string;
      }
    | undefined;
  const label = status?.revoked ? "Revoked" : status?.approved ? "Approved" : "Unknown";
  const className = status?.revoked ? "status-revoked" : "status-approved";

  return (
    <DashboardCard title={props.certHash}>
      {query.isLoading ? (
        <p className="text-sm text-slate-500">Loading status...</p>
      ) : status ? (
        <div className="grid gap-3">
          <span className={`status-chip ${className}`}>{label}</span>
          <Detail label="Issuer" value={status.issuer} />
          <Detail label="Subject" value={status.subject} />
          <Detail label="Serial Number" value={status.serialNumber} />
          <Detail label="validFrom" value={status.validFrom.toString()} />
          <Detail label="validTo" value={status.validTo.toString()} />
          <Detail label="Memo" value={status.memo} />
        </div>
      ) : (
        <p className="text-sm text-slate-500">No status found.</p>
      )}
    </DashboardCard>
  );
}

function DashboardCard(props: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/75 p-5">
      <h3 className="m-0 text-sm font-semibold">{props.title}</h3>
      <div className="mt-4">{props.children}</div>
    </article>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="m-0 text-sm break-all">{props.value || "-"}</p>
    </div>
  );
}
