import { useMemo, useState } from "react";
import { normalizeDomain } from "../../lib/domain/hash";
import { queryCrtSh } from "../../lib/ct-api/crtsh";
import { normalizeCrtShEntries } from "../../lib/ct-api/normalize";
import type {
  CrtSearchResultItem,
  CrtSearchReviewState
} from "../../types/admin";

export function CtDiscoveryPanel() {
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CrtSearchResultItem[]>([]);

  const normalizedDomain = normalizeDomain(domain);

  async function handleDiscover() {
    if (!normalizedDomain) return;

    setIsLoading(true);
    setError(null);

    try {
      const crtShEntries = await queryCrtSh(normalizedDomain);
      setResults(normalizeCrtShEntries(normalizedDomain, crtShEntries));
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "CT discovery failed. Check crt.sh availability or proxy configuration.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function rejectCandidate(resultId: string) {
    setResults((current) =>
      current.map((item) =>
        item.id === resultId ? { ...item, reviewState: "Rejected" } : item
      )
    );
  }

  const counts = useMemo(() => countStates(results), [results]);

  return (
    <section className="glass p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            CT Discovery
          </p>
          <h2 className="m-0 text-xl font-semibold">crt.sh Search Results</h2>
          <p className="mt-2 text-sm text-slate-500">
            crt.sh에서 domain 관련, 만료되지 않은 인증서 메타데이터를 가져와 검색 결과로 보여줍니다. 이 단계에서는 PEM 다운로드나 certHash 계산을 수행하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateChip label={`Pending ${counts.Pending}`} state="Pending" />
          <StateChip label={`Needs Review ${counts["Needs Review"]}`} state="Needs Review" />
          <StateChip label={`Rejected ${counts.Rejected}`} state="Rejected" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="field">
          <label htmlFor="ct-domain-input">Domain</label>
          <input
            id="ct-domain-input"
            placeholder="example.com"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
        </div>
        <button className="btn btn-primary self-end" disabled={isLoading || !normalizedDomain} onClick={handleDiscover}>
          {isLoading ? "Discovering..." : "Query crt.sh"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-sm text-slate-600">
        만료되지 않은 crt.sh 결과를 개수 제한 없이 그대로 표시합니다. wildcard-only 또는 exact domain이 없는 인증서는 `Needs Review`로 표시합니다.
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4">
        {results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
            아직 검색 결과가 없습니다. domain을 입력하고 `Query crt.sh`를 실행하세요.
          </div>
        )}

        {results.map((item) => (
          <SearchResultCard
            key={item.id}
            item={item}
            onReject={rejectCandidate}
          />
        ))}
      </div>
    </section>
  );
}

function SearchResultCard(props: {
  item: CrtSearchResultItem;
  onReject: (candidateId: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/75 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-lg font-semibold">{props.item.domain}</p>
          <p className="mt-2 text-xs text-slate-500">{props.item.externalLabel}</p>
        </div>
        <StateChip label={props.item.reviewState} state={props.item.reviewState} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Entry label="Issuer" value={props.item.issuer} />
        <Entry label="Subject" value={props.item.subject} />
        <Entry label="Serial Number" value={props.item.serialNumber} />
        <Entry label="validFrom" value={props.item.validFrom || "-"} />
        <Entry label="validTo" value={props.item.validTo || "-"} />
        <Entry label="Identities" value={props.item.identities.join(", ")} />
      </div>

      {props.item.wildcard && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Wildcard certificate입니다. MVP 정책상 exact domain-only verification을 유지하므로 manual review 후 approval 여부를 판단해야 합니다.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="btn btn-secondary"
          disabled={props.item.reviewState === "Rejected"}
          onClick={() => props.onReject(props.item.id)}
        >
          Reject Locally
        </button>
      </div>
    </article>
  );
}

function countStates(items: CrtSearchResultItem[]) {
  return items.reduce<Record<CrtSearchReviewState, number>>(
    (accumulator, item) => {
      accumulator[item.reviewState] += 1;
      return accumulator;
    },
    {
      Pending: 0,
      Rejected: 0,
      "Needs Review": 0
    }
  );
}

function StateChip(props: { label: string; state: CrtSearchReviewState }) {
  const className =
    props.state === "Rejected"
        ? "status-revoked"
        : "status-pending";

  return <span className={`status-chip ${className}`}>{props.label}</span>;
}

function Entry(props: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="m-0 text-sm break-all">{props.value}</p>
    </div>
  );
}
